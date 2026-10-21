#!/usr/bin/env python3
"""お問い合わせフォームの見張り役。

サイトのフォーム（contact.html）と、送信先のGoogleフォームが食い違っていないかを確かめる。
食い違うと、サイトから送っても「送信が完了しました」と出たまま、Googleフォームに記録されない。

確かめること
- Googleフォームが開ける（削除・非公開になっていない）
- 回答を受け付けている
- ログインしなくても回答できる
- ページ（セクション）が1つだけ
- 項目の番号（entry.〇〇）・必須かどうか・選択肢の文言が、サイトと一致している

GoogleフォームのページをGETで読むだけで、回答は送らない。
問題があれば理由を表示して終了コード1で終わる（GitHub Actions では失敗として通知される）。
"""
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_FORM = ROOT / "contact.html"


def read_site_form():
    text = SITE_FORM.read_text(encoding="utf-8")
    action = re.search(r'id="contactForm".*?action="([^"]+)"', text, re.S).group(1)
    fields = {}
    for tag in re.findall(r"<(?:input|textarea)\b[^>]*>", text):
        m = re.search(r'name="entry\.(\d+)"', tag)
        if not m:
            continue
        f = fields.setdefault(m.group(1), {"required": False, "choices": []})
        if re.search(r"\brequired\b", tag):
            f["required"] = True
        v = re.search(r'type="radio"[^>]*value="([^"]*)"', tag)
        if v:
            f["choices"].append(html.unescape(v.group(1)))
    return action, fields


def read_google_form(action):
    url = action.replace("/formResponse", "/viewform")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (contact form check)"})
    with urllib.request.urlopen(req, timeout=30) as res:
        final_url = res.geturl()
        page = res.read().decode("utf-8", "replace")
    return final_url, page


def main():
    problems = []
    action, site = read_site_form()
    try:
        final_url, page = read_google_form(action)
    except Exception as e:  # noqa: BLE001
        print(f"NG: Googleフォームを開けません（{e}）")
        return 1

    if "accounts.google.com" in final_url:
        problems.append("Googleフォームがログインを求める設定になっています（ログインしていないお客様は送れません）")
    if "closedform" in final_url or "FB_PUBLIC_LOAD_DATA_" not in page:
        problems.append("Googleフォームが回答を受け付けていない、または開けない状態です")
        for p in problems:
            print("NG:", p)
        return 1

    data = json.loads(re.search(r"FB_PUBLIC_LOAD_DATA_ = (.*?);</script>", page, re.S).group(1))
    items = data[1][1] or []
    google = {}
    for item in items:
        title, kind = item[1], item[3]
        if kind == 8:
            problems.append(f"Googleフォームにセクション（ページ区切り）「{title}」があります。サイトからの送信が通らなくなります")
            continue
        for q in item[4] or []:
            google[str(q[0])] = {
                "title": title,
                "required": bool(q[2]),
                "choices": [c[0] for c in (q[1] or []) if c and c[0]],
                "has_other": any(c and len(c) > 4 and c[4] for c in (q[1] or [])),
            }

    for eid, g in google.items():
        s = site.get(eid)
        if s is None:
            if g["required"]:
                problems.append(f"Googleフォームの必須項目「{g['title']}」(entry.{eid}) がサイトのフォームにありません")
            continue
        if g["required"] and not s["required"]:
            problems.append(f"「{g['title']}」がGoogleフォームでは必須ですが、サイトでは任意です")
        if s["choices"]:
            missing = [c for c in s["choices"] if c not in g["choices"]]
            if missing and not g["has_other"]:
                problems.append(f"「{g['title']}」の選択肢 {missing} がGoogleフォームにありません（文言が変わった可能性）")
    for eid in site:
        if eid not in google:
            problems.append(f"サイトのフォームの entry.{eid} がGoogleフォームにありません（項目が削除・作り直しされた可能性）")

    if problems:
        for p in problems:
            print("NG:", p)
        return 1
    print(f"OK: Googleフォームとサイトのフォームは一致しています（{len(google)}項目）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
