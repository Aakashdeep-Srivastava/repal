"use client";

import { useId } from "react";

/**
 * RePal loading mark — outline of "rp" is always visible,
 * brand colour fills the r (bottom-up, liquid wave), then the p, then loops.
 * Zero dependencies. Respects prefers-reduced-motion.
 *
 * <RepalLoader size={96} />            // default
 * <RepalLoader size={48} speed={1.8} /> // faster
 */
type Props = {
  size?: number;          // px
  speed?: number;         // seconds per loop
  outline?: string;       // outline colour
  label?: string;         // screen-reader text
  filled?: boolean;       // show the finished, fully-filled mark (no motion)
  className?: string;
};

const R_PATH = "M230.2 989.5C213.3 985.8 205.0 976.8 205.0 962.1C205.0 955.9 315.9 277.0 319.0 264.0C324.6 241.1 336.7 227.5 357.1 221.2C364.0 219.1 508.9 218.1 522.4 220.0C532.3 221.4 538.7 224.6 543.7 230.5C549.4 237.3 550.8 242.5 550.9 256.1C551.0 266.6 550.2 272.1 543.0 310.9C538.6 334.6 535.0 354.3 535.0 354.7C535.0 355.0 540.1 350.4 546.2 344.4C596.9 295.2 652.0 266.0 714.5 254.9C729.8 252.2 766.6 251.2 783.3 252.9C839.9 259.0 892.4 281.9 924.2 314.4C953.3 344.2 967.5 379.8 971.4 432.1L971.9 438.8L908.9 500.6C874.2 534.5 844.8 563.2 843.5 564.2L841.2 566.0L835.2 556.2C810.8 516.5 776.8 490.7 738.7 482.9C713.5 477.8 671.0 480.8 639.8 490.1C596.2 503.1 568.3 532.4 551.7 583.0C544.3 605.4 541.2 621.2 511.5 786.5C495.8 874.0 482.3 948.5 481.4 952.2C477.1 970.2 466.8 982.5 450.9 988.2L444.5 990.5L340.5 990.7C254.8 990.8 235.4 990.6 230.2 989.5Z";
const P_PATH = "M549.5 1370.6C533.8 1366.7 525.5 1357.4 524.4 1342.2C523.9 1336.6 533.5 1276.0 585.0 959.2C618.6 752.2 647.0 578.5 648.1 573.2C658.8 521.2 680.1 488.9 708.5 481.6C713.6 480.3 725.5 480.1 787.8 480.0C859.2 479.9 861.3 480.0 868.9 482.0C881.8 485.5 890.4 493.7 894.4 506.4L896.2 512.2L891.9 516.8L887.5 521.5L891.7 517.6C896.4 513.2 896.8 513.4 897.2 521.3L897.5 526.1L904.0 521.5C962.6 479.9 1041.7 463.8 1115.0 478.4C1138.8 483.2 1170.6 493.9 1196.0 505.8C1286.3 548.1 1340.1 620.1 1352.6 715.5C1355.0 733.7 1355.1 775.4 1352.7 794.0C1343.3 868.3 1317.4 932.5 1275.8 984.8C1194.4 1086.9 1058.4 1133.3 921.5 1105.5C912.1 1103.6 900.1 1100.7 894.8 1099.1L885.1 1096.2L884.0 1101.4C883.5 1104.2 877.4 1136.0 870.5 1172.0C848.0 1289.4 840.0 1329.9 838.4 1334.7C831.9 1354.1 819.9 1365.6 801.2 1370.5C793.2 1372.5 557.9 1372.7 549.5 1370.6ZM1074.5 941.5C1138.5 929.2 1189.8 872.6 1199.5 803.5C1205.7 759.2 1197.0 719.0 1173.9 684.5C1139.8 633.8 1081.3 611.9 1023.0 628.2C996.9 635.4 967.8 654.7 950.2 676.3C912.4 722.9 900.3 781.5 916.6 838.5C923.8 863.3 936.5 884.4 956.0 904.0C977.1 925.2 1001.4 937.6 1031.3 942.6C1041.3 944.2 1063.0 943.7 1074.5 941.5Z";
const NOTCH_PATH = "M836.7 557.6C826.0 539.3 806.3 517.2 790.0 505.1C774.4 493.5 753.8 484.8 734.0 481.5C727.5 480.4 735.9 480.2 794.0 480.1C859.1 480.0 861.8 480.1 868.9 482.0C880.6 485.3 888.1 491.4 892.5 501.5C897.4 512.4 899.3 509.3 868.7 539.1L841.5 565.7L836.7 557.6Z";

// one wave period = 600 units; drawn 4 periods wide so it can slide forever
const WAVE =
  "M0 0 Q150 -45 300 0 T600 0 T900 0 T1200 0 T1500 0 T1800 0 T2100 0 T2400 0 V1400 H0 Z";

export default function RepalLoader({
  size = 96,
  speed = 2.8,
  // Theme-aware outline: a translucent brand tint that reads on both the light
  // and dark card backgrounds (the app toggles theme via data-theme).
  outline = "color-mix(in oklab, var(--color-brand) 40%, transparent)",
  label = "Loading",
  filled = false,
  className,
}: Props) {
  const id = useId().replace(/:/g, "");
  const css = `
    .rpl-${id} { --t:${speed}s; }
    .rpl-${id} .rpl-stroke { stroke-dasharray:1; stroke-dashoffset:1; animation: rpl-draw-${id} .9s ease-out forwards; }
    .rpl-${id} .rpl-rise-r { animation: rpl-r-${id} var(--t) cubic-bezier(.45,.05,.35,1) infinite; }
    .rpl-${id} .rpl-rise-p { animation: rpl-p-${id} var(--t) cubic-bezier(.45,.05,.35,1) infinite; }
    .rpl-${id} .rpl-wave   { animation: rpl-wave-${id} 1.1s linear infinite; }
    .rpl-${id} .rpl-fills  { animation: rpl-fade-${id} var(--t) ease-in-out infinite; }
    @keyframes rpl-draw-${id} { to { stroke-dashoffset:0; } }
    @keyframes rpl-wave-${id} { from { transform:translateX(0); } to { transform:translateX(-600px); } }
    @keyframes rpl-r-${id} { 0%{transform:translateY(1010px)} 38%{transform:translateY(170px)} 100%{transform:translateY(170px)} }
    @keyframes rpl-p-${id} { 0%,32%{transform:translateY(1390px)} 72%{transform:translateY(430px)} 100%{transform:translateY(430px)} }
    @keyframes rpl-fade-${id} { 0%,84%{opacity:1} 96%,100%{opacity:0} }
    .rpl-${id}.rpl-filled .rpl-rise-r, .rpl-${id}.rpl-filled .rpl-rise-p, .rpl-${id}.rpl-filled .rpl-wave, .rpl-${id}.rpl-filled .rpl-fills { animation:none; opacity:1; }
    .rpl-${id}.rpl-filled .rpl-rise-r { transform:translateY(150px); transition:transform .5s ease-out; }
    .rpl-${id}.rpl-filled .rpl-rise-p { transform:translateY(410px); transition:transform .5s ease-out; }
    @media (prefers-reduced-motion: reduce) {
      .rpl-${id} .rpl-rise-r, .rpl-${id} .rpl-rise-p, .rpl-${id} .rpl-wave { animation:none; }
      .rpl-${id} .rpl-rise-r { transform:translateY(170px); }
      .rpl-${id} .rpl-rise-p { transform:translateY(430px); }
      .rpl-${id} .rpl-fills  { animation: rpl-pulse-${id} 1.6s ease-in-out infinite; }
      @keyframes rpl-pulse-${id} { 50% { opacity:.45; } }
    }`;

  return (
    <svg
      className={`rpl-${id} ${filled ? "rpl-filled" : ""} ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="180 195 1200 1200"
      role="status"
      aria-label={label}
    >
      <style>{css}</style>
      <defs>
        {/* r (back): deep brand. p (front): brand → cyan. All from theme tokens
            so the mark matches the app and flips with the dark toggle. */}
        <linearGradient id={`gr-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-brand)" />
          <stop offset="1" stopColor="var(--color-brand-deep)" />
        </linearGradient>
        <linearGradient id={`gp-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-brand)" />
          <stop offset="1" stopColor="var(--color-cyan)" />
        </linearGradient>
        <clipPath id={`cr-${id}`}><path d={R_PATH} /></clipPath>
        <clipPath id={`cp-${id}`}><path d={P_PATH} /></clipPath>
        <clipPath id={`cn-${id}`}><path d={NOTCH_PATH} /></clipPath>
        {/* everything except the p — keeps the r tucked behind it */}
        <mask id={`behind-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1600">
          <rect width="1600" height="1600" fill="#fff" />
          <path d={P_PATH} fill="#000" stroke="#000" strokeWidth={14} strokeLinejoin="round" />
        </mask>
      </defs>

      {/* BACK: r (fill + outline), masked out wherever the p sits */}
      <g mask={`url(#behind-${id})`}>
        <g className="rpl-fills" clipPath={`url(#cr-${id})`}>
          <g className="rpl-rise-r">
            <path className="rpl-wave" d={WAVE} fill={`url(#gr-${id})`} />
          </g>
        </g>
        <path className="rpl-stroke" pathLength={1} d={R_PATH}
          fill="none" stroke={outline} strokeWidth={14} strokeLinejoin="round" />
      </g>

      {/* FRONT: p (fill + outline) */}
      <g className="rpl-fills" clipPath={`url(#cp-${id})`}>
        <g className="rpl-rise-p">
          <path className="rpl-wave" d={WAVE} fill={`url(#gp-${id})`} />
        </g>
      </g>
      <path className="rpl-stroke" pathLength={1} d={P_PATH}
        fill="none" stroke={outline} strokeWidth={14} strokeLinejoin="round" />
    </svg>
  );
}
