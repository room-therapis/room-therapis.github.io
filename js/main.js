// ============================================================
// 予約サイト（upnow）のURL。ここを変えるだけで、サイト内の
// 「ご予約」ボタンすべてに反映されます。
// ============================================================
const BOOKING_URL = "https://upnow.jp/room2023";

// お問い合わせページ（送信内容はGoogleフォームに届きます）。
const CONTACT_URL = "contact.html";

document.querySelectorAll("[data-booking-link]").forEach((el) => {
  el.setAttribute("href", BOOKING_URL);
});

document.querySelectorAll("[data-contact-link]").forEach((el) => {
  el.setAttribute("href", CONTACT_URL);
});

// ヘッダー：スクロールで背景に境界線をつける／下スクロールで隠す・上スクロールで再表示
const header = document.getElementById("siteHeader");
const heroSection = document.getElementById("top");
let lastScrollY = window.scrollY;
const onScroll = () => {
  const currentScrollY = window.scrollY;
  const heroHeight = heroSection ? heroSection.offsetHeight : 8;
  header.classList.toggle("scrolled", currentScrollY > heroHeight - header.offsetHeight);

  if (currentScrollY > lastScrollY && currentScrollY > header.offsetHeight) {
    header.classList.add("header-hidden");
  } else {
    header.classList.remove("header-hidden");
  }
  lastScrollY = currentScrollY;
};
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// モバイルナビの開閉
const navToggle = document.getElementById("navToggle");
const mainNav = document.getElementById("mainNav");
navToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});
mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

// フッターの年号
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ルームA〜Eのスワイプ切り替え：ドットの同期
const roomList = document.querySelector(".room-list");
const roomDots = document.querySelectorAll(".room-dot");
if (roomList && roomDots.length) {
  roomDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = Number(dot.dataset.roomIndex);
      const card = roomList.children[index];
      if (card) {
        roomList.scrollTo({ left: card.offsetLeft - roomList.children[0].offsetLeft, behavior: "smooth" });
      }
    });
  });

  let scrollTimeout;
  roomList.addEventListener(
    "scroll",
    () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const firstCard = roomList.children[0];
        const step = roomList.children[1].offsetLeft - firstCard.offsetLeft;
        const index = Math.round(roomList.scrollLeft / step);
        roomDots.forEach((dot, i) => {
          dot.classList.toggle("is-active", i === index);
          dot.setAttribute("aria-pressed", String(i === index));
        });
      }, 100);
    },
    { passive: true }
  );

  // 画面幅が変わったとき（PCでウィンドウを分割した時など）、表示中のお部屋に位置を合わせ直す
  window.addEventListener("resize", () => {
    const active = document.querySelector(".room-dot.is-active");
    const card = roomList.children[active ? Number(active.dataset.roomIndex) : 0];
    if (card) roomList.scrollTo({ left: card.offsetLeft - roomList.children[0].offsetLeft, behavior: "instant" });
  });
}

// 別ページから #plan などで来たとき、画像の読み込みで位置がずれても目的のセクションに合わせ続ける
// 閉じた「詳しく見る」の中にあるリンク先へ飛ぶときは、先に開いておく
const openParentDetails = (el) => {
  for (let d = el && el.closest("details"); d; d = d.parentElement.closest("details")) d.open = true;
};
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", () => {
    const id = decodeURIComponent(link.getAttribute("href").slice(1));
    if (id) openParentDetails(document.getElementById(id));
  });
});

const hashTarget = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
openParentDetails(hashTarget);
if (hashTarget) {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const alignToHash = () => {
    window.scrollTo({ top: hashTarget.getBoundingClientRect().top + window.scrollY, behavior: "instant" });
  };
  const layoutWatcher = new ResizeObserver(alignToHash);
  layoutWatcher.observe(document.body);
  const stopAligning = () => layoutWatcher.disconnect();
  ["wheel", "touchstart", "keydown"].forEach((type) => {
    window.addEventListener(type, stopAligning, { once: true, passive: true });
  });
  setTimeout(stopAligning, 3000);
  alignToHash();
}

// PC（1024px以上）：選ばれる理由の2つを横並びにし、「詳しく見る」の中身は2つの下に全幅で開く
const pointExpand = document.querySelector(".core-points-expand");
const pointMores = [...document.querySelectorAll(".core-point > .point-more")];
if (pointExpand && pointMores.length) {
  const wideMq = window.matchMedia("(min-width: 600px)");
  pointMores.forEach((d) => { d._body = d.querySelector(".point-more-body"); });
  const placeBodies = () => {
    pointMores.forEach((d) => {
      if (wideMq.matches && d.open) {
        if (d._body.parentElement !== pointExpand) pointExpand.appendChild(d._body);
      } else if (d._body.parentElement !== d) {
        d.appendChild(d._body);
      }
    });
  };
  pointMores.forEach((d) => {
    d.addEventListener("toggle", () => {
      if (wideMq.matches && d.open) pointMores.forEach((o) => { if (o !== d) o.open = false; });
      placeBodies();
    });
  });
  wideMq.addEventListener("change", placeBodies);
  placeBodies();
}
