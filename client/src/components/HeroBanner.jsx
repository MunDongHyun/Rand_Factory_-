import { useState, useEffect, useCallback } from "react";
import '../styles/Dashboard.css';

const SLIDES = [
    {
        id: 1,
        articleId: 28,
        eyebrow: "SPECIAL REPORT",
        title: "AI 자동화 위험을 줄이기 위한\n새로운 HRD 전략",
        desc: "자동화가 가속화되는 시대, 인적 자원 개발의 패러다임은 어떻게 바뀌어야 하는가. 조직이 살아남기 위한 핵심 역량 재설계 전략을 제시한다.",
        tag: "#HRD #자동화 #미래인재",
        bg: "linear-gradient(135deg, #293a49 0%, #2c344f 50%, #292542 100%)",
    },
    {
        id: 2,
        articleId: 42,
        eyebrow: "FEATURED",
        title: "DBR과 함께 학습하는\n조직 소개",
        desc: "지식 기반 조직 문화를 선도하는 기업들의 이야기. DBR 아티클을 중심으로 구성된 학습 생태계가 어떤 변화를 만들어내고 있는지 살펴본다.",
        tag: "#조직학습 #DBR #기업문화",
        bg: "linear-gradient(135deg, #2a2218 0%, #3d2e20 50%, rgb(54, 38, 32) 100%)",
    },
];

const INTERVAL = 6000;

export default function HeroBanner({ showCreateCta = true, onCreateCurriculum, onOpenArticle }) {
    const [current, setCurrent] = useState(0);
    const [animating, setAnimating] = useState(false);
    const [direction, setDirection] = useState("next");

    const goTo = useCallback((index, dir = "next") => {
        if (animating) return;
        setDirection(dir);
        setAnimating(true);
        setTimeout(() => {
            setCurrent(index);
            setAnimating(false);
        }, 400);
    }, [animating]);

    const next = useCallback(() => {
        goTo((current + 1) % SLIDES.length, "next");
    }, [current, goTo]);

    const prev = useCallback(() => {
        goTo((current - 1 + SLIDES.length) % SLIDES.length, "prev");
    }, [current, goTo]);

    useEffect(() => {
        const timer = setInterval(next, INTERVAL);
        return () => clearInterval(timer);
    }, [next]);

    const slide = SLIDES[current];

    return (
        <>
            {/* 배너 */}
            <div className="bannerRoot" style={{ background: slide.bg }}>

                <div className="bannerContent">
                    <div className="bannerNumber">{String(current + 1).padStart(2, "0")}</div>
                    <div
                        className={`bannerText ${animating ? `animating-${direction}` : ''}`}
                        onClick={() => {
                            if (slide.articleId && onOpenArticle) {
                                onOpenArticle({ article_id: slide.articleId });
                            }
                        }}
                        role={slide.articleId ? "button" : undefined}
                        style={slide.articleId ? { cursor: "pointer" } : undefined}
                    >

                        <div className="bannerEyebrow">
                            <span className="bannerEyebrowLine" />
                            {slide.eyebrow}
                        </div>
                        <h2 className="bannerTitle">{slide.title}</h2>
                        <p className="bannerDesc">{slide.desc}</p>
                        <p className="bannerTag">{slide.tag}</p>
                    </div>

                    <div className="bannerDivider" />

                    <div className="bannerNav">
                        <div className="bannerArrows">
                            <button className="bannerArrow" onClick={prev}>‹</button>
                            <button className="bannerArrow" onClick={next}>›</button>
                        </div>
                        <div className="bannerIndicators">
                            {SLIDES.map((_, i) => (
                                <div
                                    key={i}
                                    className={`bannerDot ${i === current ? "active" : ""}`}
                                    onClick={() => goTo(i)}
                                />
                            ))}
                        </div>
                        <div className="bannerCounter">
                            {String(current + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
                        </div>
                    </div>
                </div>

                <div className="bannerProgress">
                    <div className="bannerProgressFill" key={current} />
                </div>
            </div>

            {/* 플로팅 CTA */}
            <div className={`floatingCta ${showCreateCta ? '' : 'floatingCtaHidden'}`}>
                <button className="floatingCtaBtn" onClick={onCreateCurriculum}>
                    <span className="floatingCtaIcon">✦</span>
                    커리큘럼 생성하기
                </button>
            </div>
        </>
    );
}
