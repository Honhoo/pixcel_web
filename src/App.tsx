import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import BorderGlow from "./BorderGlow";
import Grainient from "./Grainient";
import { caseStudies as fallbackCaseStudies, categories, isHomeFeaturedCase, loadCaseStudies, type CaseStudy, type Category, type MasonryMediaItem } from "./cases";
import { isAdminAuthed } from "./auth";

gsap.registerPlugin(ScrollTrigger);

const MASONRY_PAGE_SIZE = 36;
const FEATURED_HOME_LIMIT = 12;

const services = [
  {
    title: "KEY VISUAL",
    eyebrow: "01",
    body: "赛事、品牌、活动主视觉，用高识别度画面建立第一眼记忆。",
  },
  {
    title: "PACKAGE",
    eyebrow: "02",
    body: "品牌包装、赛事包装、直播导视与延展物料，统一线上线下视觉秩序。",
  },
  {
    title: "媒体传播",
    eyebrow: "03",
    body: "社媒物料、倒计时内容、活动传播与现场执行，让视觉持续抵达受众。",
  },
  {
    title: "虚幻引擎",
    eyebrow: "04",
    body: "三维动态、虚拟演播室、沉浸式视觉与大屏内容，服务更具现场感的数字体验。",
  },
];

const gameLogos = [
  { name: "HOS Nexus", src: "/assets/service-games/game-01.png" },
  { name: "QQ飞车", src: "/assets/service-games/game-02.png", offsetY: "-4px" },
  { name: "VALORANT", src: "/assets/service-games/game-03.png" },
  { name: "暗黑破坏神", src: "/assets/service-games/game-04.png", offsetY: "-2px" },
  { name: "百闻牌", src: "/assets/service-games/game-05.png", offsetY: "-2px" },
  { name: "部落冲突", src: "/assets/service-games/game-06.png", offsetY: "-1px" },
  { name: "穿越火线", src: "/assets/service-games/game-07.png", offsetY: "-1px" },
  { name: "大话西游2经典版", src: "/assets/service-games/game-08.png", offsetY: "2px" },
  { name: "大话西游", src: "/assets/service-games/game-09.png", offsetY: "-1px" },
  { name: "大唐无双", src: "/assets/service-games/game-10.png", offsetY: "-1px" },
  { name: "蛋仔派对", src: "/assets/service-games/game-11.png", offsetY: "-2px" },
  { name: "第五人格", src: "/assets/service-games/game-12.png", offsetY: "-2px" },
  { name: "巅峰极速", src: "/assets/service-games/game-13.png", offsetY: "-3px" },
  { name: "光遇", src: "/assets/service-games/game-14.png", offsetY: "-6px" },
  { name: "哈利波特", src: "/assets/service-games/game-15.png", offsetY: "-3px" },
  { name: "和平精英", src: "/assets/service-games/game-16.png", offsetY: "-2px" },
  { name: "荒野行动", src: "/assets/service-games/game-17.png", offsetY: "-2px" },
  { name: "皇室战争", src: "/assets/service-games/game-18.png", offsetY: "-2px" },
  { name: "决战平安京", src: "/assets/service-games/game-19.png", offsetY: "-1px" },
  { name: "狼人杀", src: "/assets/service-games/game-20.png", offsetY: "-3px" },
  { name: "炉石传说", src: "/assets/service-games/game-21.png", offsetY: "-5px" },
  { name: "率土之滨", src: "/assets/service-games/game-22.png", offsetY: "-2px" },
  { name: "三国杀", src: "/assets/service-games/game-23.png", offsetY: "-3px" },
  { name: "三角洲行动", src: "/assets/service-games/game-24.png" },
  { name: "实况足球", src: "/assets/service-games/game-25.png" },
  { name: "守望先锋", src: "/assets/service-games/game-26.png", offsetY: "-5px" },
  { name: "王者荣耀", src: "/assets/service-games/game-27.png", offsetY: "-6px" },
  { name: "无畏契约", src: "/assets/service-games/game-28.png", offsetY: "-3px" },
  { name: "星际争霸2", src: "/assets/service-games/game-29.png", offsetY: "-3px" },
  { name: "英雄联盟", src: "/assets/service-games/game-30.png", offsetY: "-3px" },
  { name: "影之诗", src: "/assets/service-games/game-31.png", offsetY: "-6px" },
  { name: "游戏王", src: "/assets/service-games/game-32.png", offsetY: "-5px" },
];

type CaseMasonryItem = {
  caseStudy: CaseStudy;
  media: MasonryMediaItem;
};

function getMasonryMediaForCase(caseStudy: CaseStudy): MasonryMediaItem[] {
  const checkedDetailMedia = caseStudy.detailMedia
    .filter((media) => media.showInMasonry)
    .map(
      (media): MasonryMediaItem => ({
        type: media.type,
        src: media.src,
        poster: media.poster,
        alt: media.alt || caseStudy.title,
      }),
    );

  if (checkedDetailMedia.length > 0) return checkedDetailMedia;
  if (caseStudy.masonryMedia && caseStudy.masonryMedia.length > 0) return caseStudy.masonryMedia;
  if (caseStudy.masonryImages.length > 0) {
    return caseStudy.masonryImages.map((src) => ({ type: "image" as const, src, alt: caseStudy.title }));
  }
  return caseStudy.cover ? [{ type: "image" as const, src: caseStudy.cover, alt: caseStudy.title }] : [];
}

type ActiveCaseState = {
  item: CaseStudy;
  initialMediaSrc?: string;
};

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, value.length);

  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!copied) {
    throw new Error("Copy failed");
  }
}

function getCaseShareUrl(caseId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("case", caseId);
  url.hash = "";
  return url.toString();
}

const heroServices = ["视觉设计", "品牌包装", "虚幻引擎", "媒体传播"];

const businessContacts = [
  {
    id: "huanghao",
    name: "黄浩",
    phone: "13122030715",
    email: "13122030715@163.com",
  },
  {
    id: "zhangzimeng",
    name: "张梓萌",
    phone: "15651458178",
    email: "m15651458178@163.com",
  },
];

function App() {
  const [activeCase, setActiveCase] = useState<ActiveCaseState | null>(null);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [caseStudyItems, setCaseStudyItems] = useState<CaseStudy[]>(fallbackCaseStudies);
  const [scrollRatio, setScrollRatio] = useState(0);
  const [galleryCategory, setGalleryCategory] = useState<"全部" | Category>("全部");
  const [galleryPage, setGalleryPage] = useState(1);
  const [showAllFeaturedCases, setShowAllFeaturedCases] = useState(false);
  const [copiedContact, setCopiedContact] = useState<string | null>(null);
  const openedSharedCaseRef = useRef<string | null>(null);

  const allFeaturedCases = useMemo(
    () =>
      [...caseStudyItems]
        .filter((item) => item.featured)
        .sort((a, b) => a.featuredOrder - b.featuredOrder),
    [caseStudyItems],
  );

  const homeFeaturedCases = useMemo(
    () => allFeaturedCases.filter(isHomeFeaturedCase).slice(0, FEATURED_HOME_LIMIT),
    [allFeaturedCases],
  );

  const caseMasonryItems = useMemo<CaseMasonryItem[]>(() => {
    return [...caseStudyItems]
      .filter((caseStudy) => caseStudy.masonry)
      .sort((a, b) => a.masonryOrder - b.masonryOrder)
      .flatMap((caseStudy) => {
        const mediaItems = getMasonryMediaForCase(caseStudy);

        return mediaItems
          .filter((media, index, allMedia) => allMedia.findIndex((item) => item.src === media.src && item.type === media.type) === index)
          .map((media) => ({
            caseStudy,
            media: {
              ...media,
              poster: media.type === "video" ? media.poster || caseStudy.cover : media.poster,
              alt: media.alt || caseStudy.title,
            },
          }));
      });
  }, [caseStudyItems]);

  const filteredMasonryItems = useMemo(() => {
    if (galleryCategory === "全部") return caseMasonryItems;
    return caseMasonryItems.filter((item) => item.caseStudy.category === galleryCategory);
  }, [caseMasonryItems, galleryCategory]);

  const totalGalleryPages = Math.max(1, Math.ceil(filteredMasonryItems.length / MASONRY_PAGE_SIZE));
  const currentGalleryPage = Math.min(galleryPage, totalGalleryPages);
  const pagedMasonryItems = filteredMasonryItems.slice(
    (currentGalleryPage - 1) * MASONRY_PAGE_SIZE,
    currentGalleryPage * MASONRY_PAGE_SIZE,
  );

  const selectGalleryCategory = (category: "全部" | Category) => {
    setGalleryCategory(category);
    setGalleryPage(1);
  };

  const openCase = (item: CaseStudy, initialMediaSrc?: string) => {
    setActiveCase({ item, initialMediaSrc });
  };

  const copyContact = async (key: string, value: string) => {
    try {
      await copyTextToClipboard(value);
    } catch {
      // Some in-app browsers block clipboard writes on insecure origins.
    }
    setCopiedContact(key);
    window.setTimeout(() => setCopiedContact(null), 1600);
  };

  useLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return undefined;

    const context = gsap.context(() => {
      const opening = gsap.timeline({ defaults: { ease: "power4.out" } });

      gsap.set(".site-header", { y: -28, opacity: 0 });
      gsap.set(".hero-video-bg", { scale: 1.16, filter: "blur(10px) brightness(0.62)" });
      gsap.set(".hero-topline span", { y: -18, opacity: 0 });
      gsap.set(".hero-service-item", { x: -26, opacity: 0, clipPath: "inset(0 100% 0 0)" });
      gsap.set(".hero-poster-content h1", {
        clipPath: "inset(0 100% 0 0)",
        scale: 1.16,
        x: -72,
        transformOrigin: "left center",
      });
      gsap.set(".hero-chinese-title", { clipPath: "inset(100% 0 0 0)", y: 42, opacity: 0 });
      gsap.set(".hero-bottom-left, .hero-bottom-center, .hero-bottom-right", { y: 36, opacity: 0 });

      opening
        .to(".opening-curtain", { yPercent: -100, duration: 1.45, ease: "expo.inOut" }, 0.15)
        .to(".hero-video-bg", { scale: 1, filter: "blur(0px) brightness(0.88)", duration: 2.1, ease: "expo.out" }, 0.28)
        .to(".site-header", { y: 0, opacity: 1, duration: 1.0 }, 0.58)
        .to(".hero-topline span", { y: 0, opacity: 1, duration: 0.95, stagger: 0.11 }, 0.72)
        .to(
          ".hero-poster-content h1",
          { clipPath: "inset(0 0% 0 0)", scale: 1, x: 0, duration: 1.45, ease: "expo.out" },
          0.95,
        )
        .to(".hero-chinese-title", { clipPath: "inset(0% 0 0 0)", y: 0, opacity: 1, duration: 1.05 }, 1.28)
        .to(".hero-service-item", { x: 0, opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 0.9, stagger: 0.09 }, 1.36)
        .to(".hero-bottom-left, .hero-bottom-center, .hero-bottom-right", { y: 0, opacity: 1, duration: 1.0, stagger: 0.12 }, 1.55);

      gsap.utils.toArray<HTMLElement>(".motion-section").forEach((section) => {
        const labels = section.querySelectorAll(".section-label");
        const titles = section.querySelectorAll(".section-heading h2, .featured-heading-inline h3, .business-contact h2, .manifesto-block h2");
        const copy = section.querySelectorAll(".section-heading p, .manifesto-copy p, .business-contact-intro");
        const cards = section.querySelectorAll(".service-glow, .manifesto-glow, .featured-case-card, .masonry-image, .business-contact-card, .manifesto-pillar");
        const logoMarquee = section.querySelectorAll(".logo-marquee");
        const images = section.querySelectorAll(".case-image img, .masonry-image img, .masonry-image video");

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top 74%",
            once: true,
          },
          defaults: { ease: "power4.out" },
        });

        if (labels.length) {
          timeline.fromTo(labels, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.72, stagger: 0.04 }, 0);
        }

        if (titles.length) {
          timeline.fromTo(
            titles,
            { y: 96, scale: 1.18, clipPath: "inset(0 0 100% 0)" },
            { y: 0, scale: 1, clipPath: "inset(0 0 0% 0)", duration: 1.12, stagger: 0.1 },
            0.08,
          );
        }

        if (copy.length) {
          timeline.fromTo(copy, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08 }, 0.38);
        }

        if (logoMarquee.length) {
          timeline.fromTo(
            logoMarquee,
            { y: 36, scale: 0.98, clipPath: "inset(0 0 24% 0)", opacity: 0 },
            { y: 0, scale: 1, clipPath: "inset(0 0 0% 0)", opacity: 1, duration: 0.82 },
            0.42,
          );
        }

        if (cards.length) {
          timeline.fromTo(
            cards,
            { y: 54, scale: 0.94, clipPath: "inset(0 0 18% 0)", opacity: 0 },
            { y: 0, scale: 1, clipPath: "inset(0 0 0% 0)", opacity: 1, duration: 0.96, stagger: 0.075 },
            0.48,
          );
        }

        images.forEach((image) => {
          gsap.fromTo(
            image,
            { scale: 1.18, yPercent: -4 },
            {
              scale: 1.04,
              yPercent: 4,
              ease: "none",
              scrollTrigger: {
                trigger: image,
                start: "top bottom",
                end: "bottom top",
                scrub: 0.8,
              },
            },
          );
        });
      });
    });

    return () => context.revert();
  }, []);

  useEffect(() => {
    loadCaseStudies().then(setCaseStudyItems);
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const tiles = gsap.utils.toArray<HTMLElement>(".case-masonry .masonry-image");
    gsap.fromTo(
      tiles,
      { y: 34, scale: 0.96, opacity: 0, clipPath: "inset(0 0 18% 0)" },
      { y: 0, scale: 1, opacity: 1, clipPath: "inset(0 0 0% 0)", duration: 0.82, stagger: 0.035, ease: "power4.out" },
    );
    ScrollTrigger.refresh();
  }, [galleryCategory, currentGalleryPage, pagedMasonryItems.length]);

  useEffect(() => {
    setAdminAuthed(isAdminAuthed());
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const ratio = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
      setScrollRatio(ratio);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!activeCase) return undefined;

    const scrollY = window.scrollY;
    document.documentElement.classList.add("modal-open");
    document.body.classList.add("modal-open");
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    return () => {
      const previousHtmlScrollBehavior = document.documentElement.style.scrollBehavior;
      const previousBodyScrollBehavior = document.body.style.scrollBehavior;

      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });

      window.requestAnimationFrame(() => {
        document.documentElement.style.scrollBehavior = previousHtmlScrollBehavior;
        document.body.style.scrollBehavior = previousBodyScrollBehavior;
      });
    };
  }, [activeCase]);

  useEffect(() => {
    const sharedCaseId = new URLSearchParams(window.location.search).get("case");
    if (!sharedCaseId || activeCase || openedSharedCaseRef.current === sharedCaseId) return;

    const sharedCase = caseStudyItems.find((item) => item.id === sharedCaseId);
    if (sharedCase) {
      openedSharedCaseRef.current = sharedCaseId;
      setActiveCase({ item: sharedCase });
    }
  }, [activeCase, caseStudyItems]);

  const heroStyle = {
    "--hero-progress": scrollRatio.toString(),
  } as React.CSSProperties;
  const showLocalAdminEntry = true;

  return (
    <>
      <header className="site-header">
        <a className="brand-mark" href="#top" aria-label="回到首页">
          <img src="/assets/brand/logo-white.png" alt="微境像素" />
        </a>
        <nav className="site-nav" aria-label="主导航">
          <a href="#about">理念</a>
          <a href="#services">业务</a>
          <a href="#cases">案例</a>
          <a href="#business">商务联系</a>
        </nav>
        {showLocalAdminEntry && (
          <a className="contact-button" href={adminAuthed ? "/admin" : "/login"} aria-label="后台入口">
            {adminAuthed ? "后台入口" : "后台登录"}
          </a>
        )}
      </header>

      <main id="top">
        <section className="hero hero-video" style={heroStyle}>
          <div className="opening-curtain" aria-hidden="true" />
          <video className="hero-video-bg" autoPlay muted loop playsInline preload="auto" poster="/assets/brand/hero-motion.jpg">
            <source src="/assets/brand/logo-showcase-2.mp4" type="video/mp4" />
          </video>
          <div className="hero-vignette" aria-hidden="true" />
          <div className="hero-grain" aria-hidden="true" />

          <div className="hero-topline">
            <span>[PORTFOLIO]</span>
            <span>[VISUAL CREATIVE STUDIO]</span>
            <span>[2026]</span>
          </div>

          <div className="hero-poster-content">
            <h1>VISION PIXEL</h1>
            <p className="hero-chinese-title">微境像素</p>
            <div className="hero-service-list" aria-label="核心业务展示">
              {heroServices.map((service, index) => (
                <span className="hero-service-item" key={service}>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                  <strong>{service}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="hero-bottom-left">
            <div className="hero-actions">
              <a href="#cases">查看案例</a>
              <span>vision pixel studio</span>
            </div>
          </div>

          <p className="hero-bottom-center">
            以品牌秩序与商业审美，构建可落地的视觉系统。
          </p>

          <p className="hero-bottom-right">
            <span>像素入微境</span>
            <strong>专注像素级精准表达</strong>
          </p>
        </section>

        <div className="below-hero-shell">
          <Grainient
            blendAngle={75}
            blendSoftness={0.16}
            centerX={0.08}
            centerY={-0.02}
            className="below-hero-grainient"
            color1="#154000"
            color2="#000000"
            color3="#004951"
            colorBalance={-0.16}
            contrast={1.35}
            gamma={0.95}
            grainAmount={0.035}
            grainAnimated={false}
            grainScale={1.4}
            noiseScale={2.65}
            rotationAmount={360}
            saturation={0.82}
            timeSpeed={0.22}
            warpAmplitude={55}
            warpFrequency={6.4}
            warpSpeed={1.2}
            warpStrength={1.05}
            zoom={1}
          />

          <section className="section intro team-advantages motion-section" id="about">
            <div className="studio-manifesto">
              <BorderGlow
                backgroundColor="rgba(255,255,255,0.035)"
                borderRadius={8}
                className="manifesto-glow"
                colors={["#b6ff00", "#64ff8f", "#f6f8f4"]}
                coneSpread={18}
                edgeSensitivity={12}
                fillOpacity={0.12}
                glowColor="78 100 50"
                glowIntensity={1.45}
                glowRadius={30}
              >
                <article className="manifesto-block">
                  <div className="manifesto-card-head">
                    <span className="section-label">STUDIO BELIEF</span>
                    <h2>WHAT WE DO</h2>
                  </div>
                  <div className="manifesto-copy">
                    <p>
                      微境像素是一家以 <mark>"像素入微境"</mark> 为核心理念的视觉设计工作室。我们相信，每一个像素都是通往极致美学的微观入口。
                    </p>
                    <p>
                      通过像素级的精准控制和细腻入微的创意表达，我们为品牌营造独特的视觉境界，让设计成为触动人心的艺术体验。
                    </p>
                  </div>
                </article>
              </BorderGlow>

              <BorderGlow
                backgroundColor="rgba(255,255,255,0.035)"
                borderRadius={8}
                className="manifesto-glow"
                colors={["#b6ff00", "#64ff8f", "#f6f8f4"]}
                coneSpread={18}
                edgeSensitivity={12}
                fillOpacity={0.12}
                glowColor="78 100 50"
                glowIntensity={1.45}
                glowRadius={30}
              >
                <article className="manifesto-block">
                  <div className="manifesto-card-head">
                    <span className="section-label">TEAM METHOD</span>
                    <h2>WHO WE ARE</h2>
                  </div>
                  <div className="manifesto-copy">
                    <p>
                      10年+行业深耕经验，深刻理解产品需求的活动及赛事问题，专业解决团队，擅长把复杂需求拆解成清晰、可执行的视觉方案。
                    </p>
                    <p>
                      从主视觉、包装延展到传播物料与现场执行，保持审美判断、制作效率与落地稳定性统一，并充分彰显产品特色。
                    </p>
                  </div>
                  <div className="manifesto-pillars" aria-label="团队优势关键词">
                    <div className="manifesto-pillar">
                      <span />
                      <strong>彰显产品特色</strong>
                    </div>
                    <div className="manifesto-pillar">
                      <span />
                      <strong>匹配阶段目标</strong>
                    </div>
                    <div className="manifesto-pillar">
                      <span />
                      <strong>满足客户需求</strong>
                    </div>
                  </div>
                </article>
              </BorderGlow>
            </div>
          </section>

          <section className="section service-content motion-section" id="game-services">
            <div className="section-heading compact-heading">
              <div>
                <span className="section-label">SERVICE CONTENT</span>
                <h2>服务内容</h2>
              </div>
              <p>覆盖多类型游戏与赛事项目，以长期服务经验沉淀稳定、高效、可延展的视觉生产能力。</p>
            </div>
            <div className="logo-marquee" aria-label="服务游戏 Logo 滚动展示">
              <LogoTrack logos={gameLogos} />
              <LogoTrack logos={[...gameLogos].reverse()} reverse />
            </div>
          </section>

          <section className="section services motion-section" id="services">
            <div className="section-heading">
              <div>
                <span className="section-label">WHAT WE DO</span>
                <h2>核心业务矩阵</h2>
              </div>
              <p>从静态主视觉到动态影像，从传播物料到虚拟场景，把创意表达落到可执行的视觉系统中。</p>
            </div>
            <div className="service-grid">
              {services.map((service) => (
                <BorderGlow
                  animated={service.eyebrow === "01"}
                  backgroundColor="rgba(255,255,255,0.035)"
                  borderRadius={8}
                  className="service-glow"
                  colors={["#b6ff00", "#64ff8f", "#f6f8f4"]}
                  coneSpread={18}
                  edgeSensitivity={12}
                  fillOpacity={0.12}
                  glowColor="78 100 50"
                  glowIntensity={1.55}
                  glowRadius={28}
                  key={service.title}
                >
                  <article className="service-card">
                    <span>{service.eyebrow}</span>
                    <h3>{service.title}</h3>
                    <p>{service.body}</p>
                  </article>
                </BorderGlow>
              ))}
            </div>
          </section>

          <section className="section work motion-section" id="cases">
            <div className="section-heading">
              <div>
                <span className="section-label">SELECTED WORK</span>
                <h2>过往案例</h2>
              </div>
              <div className="featured-heading-inline">
                <span className="section-label">FEATURED CASES</span>
                <h3>精品案例展示</h3>
              </div>
            </div>

            <div className="work-block">
              <div className="featured-case-grid">
                {homeFeaturedCases.map((item) => (
                  <FeaturedCaseCard item={item} key={item.id} onOpen={openCase} />
                ))}
              </div>
              {allFeaturedCases.length > 0 && (
                <div className="featured-actions">
                  <button
                    className="featured-more-button"
                    type="button"
                    onClick={() => setShowAllFeaturedCases((visible) => !visible)}
                  >
                    {showAllFeaturedCases ? "收起精品案例" : "查看更多精品案例"}
                  </button>
                  <span>
                    首页精选最多 {FEATURED_HOME_LIMIT} 个 / 全部精品 {allFeaturedCases.length} 个
                  </span>
                </div>
              )}
              {showAllFeaturedCases && (
                <div className="featured-expanded">
                  <div className="featured-expanded-heading">
                    <span className="section-label">ALL FEATURED CASES</span>
                    <h3>全部精品案例</h3>
                  </div>
                  <div className="featured-case-grid featured-case-grid-all">
                    {allFeaturedCases.map((item) => (
                      <FeaturedCaseCard item={item} key={`all-${item.id}`} onOpen={openCase} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="work-block">
              <div className="work-block-heading gallery-heading">
                <span className="section-label">CATEGORY GALLERY</span>
              </div>
              <div className="category-bar gallery-category-bar" aria-label="案例分类筛选">
                {categories.map((category) => (
                  <button
                    className={galleryCategory === category ? "active" : ""}
                    key={category}
                    onClick={() => selectGalleryCategory(category)}
                    type="button"
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="case-masonry" aria-label="分类展示">
                {pagedMasonryItems.map((item, index) => (
                  <MasonryTile item={item} key={`${item.caseStudy.id}-${item.media.src}-${index}`} onOpen={openCase} />
                ))}
              </div>
              {totalGalleryPages > 1 && (
                <div className="gallery-pagination" aria-label="分类展示分页">
                  <button type="button" disabled={currentGalleryPage === 1} onClick={() => setGalleryPage((page) => Math.max(1, page - 1))}>
                    上一页
                  </button>
                  {Array.from({ length: totalGalleryPages }, (_, index) => index + 1).map((page) => (
                    <button
                      className={currentGalleryPage === page ? "active" : ""}
                      key={page}
                      type="button"
                      onClick={() => setGalleryPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={currentGalleryPage === totalGalleryPages}
                    onClick={() => setGalleryPage((page) => Math.min(totalGalleryPages, page + 1))}
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="footer motion-section" id="business">
        <div className="business-contact">
          <div className="business-contact-heading">
            <span className="section-label">BUSINESS INQUIRY</span>
            <h2>商务&需求</h2>
          </div>
          <div className="business-contact-main">
            <p className="business-contact-intro">项目咨询、商务合作、视觉需求请联系</p>
            <div className="business-contact-cards">
              {businessContacts.map((contact) => (
                <article className="business-contact-card" key={contact.id}>
                  <span>CONTACT</span>
                  <strong>{contact.name}</strong>
                  <div className="business-contact-actions">
                    <div className="contact-action-group">
                      <a href={`tel:${contact.phone}`}>电话 / 微信：{contact.phone}</a>
                      <button type="button" onClick={() => copyContact(`${contact.id}-phone`, contact.phone)}>
                        {copiedContact === `${contact.id}-phone` ? "已复制" : "复制"}
                      </button>
                    </div>
                    <div className="contact-action-group">
                      <a href={`mailto:${contact.email}`}>Email：{contact.email}</a>
                      <button type="button" onClick={() => copyContact(`${contact.id}-email`, contact.email)}>
                        {copiedContact === `${contact.id}-email` ? "已复制" : "复制"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
        <img src="/assets/brand/logo-white.png" alt="微境像素" />
        <p>Pixel-level visual expression for brands, events and digital experiences.</p>
      </footer>

      {activeCase && (
        <CaseModal
          initialMediaSrc={activeCase.initialMediaSrc}
          item={activeCase.item}
          onClose={() => setActiveCase(null)}
        />
      )}
    </>
  );
}

function LogoTrack({ logos, reverse = false }: { logos: typeof gameLogos; reverse?: boolean }) {
  const trackLogos = [...logos, ...logos];

  return (
    <div className={`logo-track ${reverse ? "reverse" : ""}`}>
      {trackLogos.map((logo, index) => (
        <BorderGlow
          backgroundColor="rgba(255,255,255,0.045)"
          borderRadius={8}
          className="game-logo-glow"
          colors={["#b6ff00", "#71ffae", "#e8ffd0"]}
          coneSpread={20}
          edgeSensitivity={10}
          fillOpacity={0.16}
          glowColor="78 100 50"
          glowIntensity={1.7}
          glowRadius={24}
          key={`${logo.src}-${index}`}
        >
          <div
            className="game-logo"
            style={{ "--logo-y": logo.offsetY ?? "0px" } as React.CSSProperties}
          >
            <img src={logo.src} alt={logo.name} loading="lazy" />
          </div>
        </BorderGlow>
      ))}
    </div>
  );
}

function FeaturedCaseCard({ item, onOpen }: { item: CaseStudy; onOpen: (item: CaseStudy) => void }) {
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const floatRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [isFloating, setIsFloating] = useState(false);
  const [floatActive, setFloatActive] = useState(false);

  const canUseFloating = (event: React.PointerEvent<HTMLButtonElement>) =>
    event.pointerType === "mouse" && !window.matchMedia("(max-width: 680px)").matches;

  const updateTilt = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canUseFloating(event)) return;
    const card = cardRef.current;
    if (!card) return;

    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const boundedX = Math.min(Math.max(x, 0), 1);
      const boundedY = Math.min(Math.max(y, 0), 1);
      const rotateX = (0.5 - boundedY) * 24;
      const rotateY = (boundedX - 0.5) * 30;
      const imageX = (0.5 - boundedX) * 34;
      const imageY = (0.5 - boundedY) * 26;

      card.style.setProperty("--mx", `${boundedX * 100}%`);
      card.style.setProperty("--my", `${boundedY * 100}%`);
      card.style.setProperty("--rx", `${rotateX.toFixed(2)}deg`);
      card.style.setProperty("--ry", `${rotateY.toFixed(2)}deg`);
      card.style.setProperty("--px", `${imageX.toFixed(2)}px`);
      card.style.setProperty("--py", `${imageY.toFixed(2)}px`);

      const floatingCard = floatRef.current;
      if (!floatingCard) return;
      floatingCard.style.left = `${rect.left}px`;
      floatingCard.style.top = `${rect.top}px`;
      floatingCard.style.width = `${rect.width}px`;
      floatingCard.style.height = `${rect.height}px`;
      floatingCard.style.setProperty("--mx", `${boundedX * 100}%`);
      floatingCard.style.setProperty("--my", `${boundedY * 100}%`);
      floatingCard.style.setProperty("--rx", `${rotateX.toFixed(2)}deg`);
      floatingCard.style.setProperty("--ry", `${rotateY.toFixed(2)}deg`);
      floatingCard.style.setProperty("--px", `${imageX.toFixed(2)}px`);
      floatingCard.style.setProperty("--py", `${imageY.toFixed(2)}px`);
    });
  };

  const startFloating = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canUseFloating(event)) return;
    setIsFloating(true);
    setFloatActive(false);
    updateTilt(event);
    window.requestAnimationFrame(() => setFloatActive(true));
  };

  const resetTilt = () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--mx", "50%");
    card.style.setProperty("--my", "50%");
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
    card.style.setProperty("--px", "0px");
    card.style.setProperty("--py", "0px");
    setFloatActive(false);
    setIsFloating(false);
  };

  return (
    <>
      <button
        className={`featured-case-card ${isFloating ? "is-floating-source" : ""}`}
        onClick={() => onOpen(item)}
        onPointerEnter={startFloating}
        onPointerLeave={resetTilt}
        onPointerMove={updateTilt}
        ref={cardRef}
      >
        <span className="featured-case-surface">
          <span className="case-image">
            <img src={item.cover} alt="" loading="lazy" />
          </span>
          <small>{item.title}</small>
        </span>
      </button>
      {isFloating &&
        createPortal(
          <div className={`featured-case-float ${floatActive ? "is-active" : ""}`} ref={floatRef} aria-hidden="true">
            <span className="featured-case-surface">
              <span className="case-image">
                <img src={item.cover} alt="" />
              </span>
              <small>{item.title}</small>
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}

function MasonryTile({ item, onOpen }: { item: CaseMasonryItem; onOpen: (item: CaseStudy, initialMediaSrc?: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const playPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => undefined);
  };

  const stopPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };

  return (
    <button
      className={`masonry-image ${item.media.type === "video" ? "is-video" : ""}`}
      onClick={() => onOpen(item.caseStudy, item.media.src)}
      onMouseEnter={playPreview}
      onMouseLeave={stopPreview}
      aria-label={item.caseStudy.title}
    >
      {item.media.type === "video" ? (
        <>
          <video ref={videoRef} muted loop playsInline preload="metadata" poster={item.media.poster} aria-label={item.media.alt}>
            <source src={item.media.src} type="video/mp4" />
          </video>
          <span className="masonry-play" aria-hidden="true" />
        </>
      ) : (
        <img src={item.media.src} alt="" loading="lazy" />
      )}
      <span className="masonry-prompt">点击查看详情</span>
    </button>
  );
}

function CaseModal({ initialMediaSrc, item, onClose }: { initialMediaSrc?: string; item: CaseStudy; onClose: () => void }) {
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "done">("idle");
  const mediaRefs = useRef<Record<string, HTMLElement | null>>({});
  const fallbackDetailMedia = item.detailMedia.length > 0 ? item.detailMedia : [{ type: "image" as const, src: item.cover, alt: item.title }];
  const masonryMedia = getMasonryMediaForCase(item);
  const initialMasonryMedia = initialMediaSrc ? masonryMedia.find((media) => media.src === initialMediaSrc) : undefined;
  const detailMedia =
    initialMediaSrc && !fallbackDetailMedia.some((media) => media.src === initialMediaSrc) && initialMasonryMedia
      ? [
          {
            type: initialMasonryMedia.type,
            src: initialMasonryMedia.src,
            poster: initialMasonryMedia.poster || (initialMasonryMedia.type === "video" ? item.cover : undefined),
            alt: initialMasonryMedia.alt || item.title,
          },
          ...fallbackDetailMedia,
        ]
      : fallbackDetailMedia;

  useEffect(() => {
    if (!initialMediaSrc) return;
    const timer = window.setTimeout(() => {
      mediaRefs.current[initialMediaSrc]?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [initialMediaSrc]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (previewImage) {
        setPreviewImage(null);
        return;
      }
      onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, previewImage]);

  const shareCase = async () => {
    const url = getCaseShareUrl(item.id);

    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text: item.summary, url });
      } else {
        await copyTextToClipboard(url);
      }

      setShareStatus("done");
      window.setTimeout(() => setShareStatus("idle"), 1600);
    } catch {
      setShareStatus("idle");
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="case-title">
      <button className="modal-scrim" onClick={onClose} aria-label="关闭项目详情" />
      <article className="case-modal">
        <header className="modal-header">
          <div>
            <span>{item.category}</span>
            <h2 id="case-title">{item.title}</h2>
          </div>
          <div className="modal-actions">
            <button className="share-button" type="button" onClick={shareCase}>
              {shareStatus === "done" ? "已复制" : "分享案例"}
            </button>
            <button className="close-button" onClick={onClose} aria-label="关闭">
              ×
            </button>
          </div>
        </header>
        <p className="modal-summary">{item.summary}</p>
        <div className="tag-row">
          {item.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="media-stack">
          {detailMedia.map((media) =>
            media.type === "video" ? (
              <video
                controls
                playsInline
                preload="metadata"
                poster={media.poster}
                key={media.src}
                ref={(node) => {
                  mediaRefs.current[media.src] = node;
                }}
                aria-label={media.alt}
              >
                <source src={media.src} type="video/mp4" />
              </video>
            ) : (
              <button
                className="detail-image-button"
                key={media.src}
                ref={(node) => {
                  mediaRefs.current[media.src] = node;
                }}
                type="button"
                onClick={() => setPreviewImage({ src: media.src, alt: media.alt })}
              >
                <img src={media.src} alt={media.alt} loading="lazy" />
              </button>
            ),
          )}
        </div>
      </article>
      {previewImage && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="图片大图预览">
          <button className="image-lightbox-scrim" type="button" onClick={() => setPreviewImage(null)} aria-label="关闭图片预览" />
          <figure>
            <img src={previewImage.src} alt={previewImage.alt} />
            <button className="close-button" type="button" onClick={() => setPreviewImage(null)} aria-label="关闭图片预览">
              ×
            </button>
          </figure>
        </div>
      )}
    </div>
  );
}

export default App;
