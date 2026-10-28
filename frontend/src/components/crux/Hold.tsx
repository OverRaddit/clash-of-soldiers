import React from 'react';

/** 실내 클라이밍 홀드 8종 — 디자인 시스템 components/holds.json과 동일한 데이터. */
export const HOLD_SHAPES = [
  {
    "id": "jug",
    "name": "저그 (큰 손잡이)",
    "d": "M50 7 C76 5 95 24 94 50 C93 78 72 96 47 95 C21 94 4 74 6 47 C8 22 26 9 50 7 Z",
    "shade": "M8 60 C20 82 40 94 50 95 C72 96 93 78 94 56 C86 76 70 86 50 86 C30 86 14 74 8 60 Z",
    "hi": {
      "cx": 36,
      "cy": 30,
      "rx": 15,
      "ry": 9,
      "rot": -30
    },
    "bolt": {
      "cx": 50,
      "cy": 52
    }
  },
  {
    "id": "crimp",
    "name": "크림프 (얇은 턱)",
    "d": "M12 38 C28 20 72 18 90 32 C100 40 98 60 86 68 C62 80 30 78 12 64 C2 56 4 46 12 38 Z",
    "shade": "M10 58 C24 74 56 80 80 70 C90 66 94 58 94 52 C90 60 80 66 62 68 C40 70 20 64 10 58 Z",
    "hi": {
      "cx": 40,
      "cy": 34,
      "rx": 20,
      "ry": 6,
      "rot": -8
    },
    "bolt": {
      "cx": 52,
      "cy": 50
    }
  },
  {
    "id": "sloper",
    "name": "슬로퍼 (둥근 돔)",
    "d": "M9 72 C7 38 28 12 52 12 C78 12 96 36 92 70 C91 79 83 84 72 84 L28 84 C17 84 10 80 9 72 Z",
    "shade": "M10 66 C14 76 20 84 28 84 L72 84 C84 84 90 76 92 66 C86 74 78 76 70 76 L30 76 C20 76 14 72 10 66 Z",
    "hi": {
      "cx": 38,
      "cy": 32,
      "rx": 16,
      "ry": 9,
      "rot": -25
    },
    "bolt": {
      "cx": 52,
      "cy": 52
    }
  },
  {
    "id": "pinch",
    "name": "핀치 (세로 집기)",
    "d": "M40 5 C58 3 70 17 68 35 C66 53 73 69 65 86 C59 97 35 97 29 85 C21 69 30 53 28 35 C26 19 28 7 40 5 Z",
    "shade": "M30 70 C34 84 40 92 48 93 C58 94 64 86 66 74 C60 82 54 86 48 86 C40 86 34 80 30 70 Z",
    "hi": {
      "cx": 42,
      "cy": 24,
      "rx": 7,
      "ry": 12,
      "rot": -10
    },
    "bolt": {
      "cx": 48,
      "cy": 48
    }
  },
  {
    "id": "pocket",
    "name": "포켓 (구멍)",
    "d": "M50 9 C80 7 94 29 92 53 C90 80 72 94 50 92 C24 90 8 74 8 50 C8 26 24 11 50 9 Z M58 42 C68 42 74 50 72 60 C70 68 62 72 56 70 C48 68 44 60 46 52 C48 46 52 42 58 42 Z",
    "shade": "M10 60 C18 82 36 92 50 92 C70 94 88 80 92 60 C84 76 70 84 52 84 C32 84 16 74 10 60 Z",
    "hi": {
      "cx": 34,
      "cy": 30,
      "rx": 14,
      "ry": 8,
      "rot": -30
    },
    "bolt": {
      "cx": 30,
      "cy": 56
    }
  },
  {
    "id": "foot",
    "name": "풋칩 (발 홀드)",
    "d": "M50 12 C56 12 61 16 64 24 L89 70 C93 78 89 87 80 87 L20 87 C11 87 7 78 11 70 L36 24 C39 16 44 12 50 12 Z",
    "shade": "M12 74 C14 82 18 87 26 87 L74 87 C82 87 86 82 88 74 C80 80 70 80 60 80 L40 80 C30 80 20 80 12 74 Z",
    "hi": {
      "cx": 44,
      "cy": 36,
      "rx": 8,
      "ry": 12,
      "rot": 25
    },
    "bolt": {
      "cx": 50,
      "cy": 60
    }
  },
  {
    "id": "volume",
    "name": "볼륨 (각진 덩어리)",
    "d": "M12 68 L38 10 L92 26 L88 84 L28 92 Z",
    "shade": "M12 68 L28 92 L88 84 L86 62 L30 70 Z",
    "hi": {
      "cx": 46,
      "cy": 30,
      "rx": 18,
      "ry": 7,
      "rot": 14
    },
    "bolt": {
      "cx": 56,
      "cy": 52
    }
  },
  {
    "id": "twin",
    "name": "더블 로브 (쌍둥이)",
    "d": "M30 17 C44 9 54 21 52 35 C54 23 68 13 82 23 C96 33 92 55 80 65 C70 73 60 69 52 79 C44 91 24 89 14 75 C4 61 10 29 30 17 Z",
    "shade": "M14 68 C20 84 34 92 46 88 C54 84 56 78 60 74 C66 70 76 70 82 60 C76 70 66 72 56 74 C46 78 36 84 24 78 C18 76 16 72 14 68 Z",
    "hi": {
      "cx": 34,
      "cy": 32,
      "rx": 12,
      "ry": 8,
      "rot": -30
    },
    "bolt": {
      "cx": 40,
      "cy": 54
    }
  }
] as const;

export type HoldColor = 'blue' | 'green' | 'orange' | 'purple' | 'pink' | 'yellow' | 'lime' | 'red';
export type HoldShapeId = (typeof HOLD_SHAPES)[number]['id'];

/** 같은 seed는 항상 같은 모양 — 게임·방·플레이어 id를 넘긴다. */
export function holdShapeFor(seed: string): (typeof HOLD_SHAPES)[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HOLD_SHAPES[h % HOLD_SHAPES.length];
}

export function randomHoldShape(): (typeof HOLD_SHAPES)[number] {
  return HOLD_SHAPES[Math.floor(Math.random() * HOLD_SHAPES.length)];
}

interface HoldProps {
  color: HoldColor;
  /** 고정 모양. 없으면 seed로 정하고, seed도 없으면 랜덤. */
  shape?: HoldShapeId;
  seed?: string;
  size?: number;
  rotate?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

const Hold: React.FC<HoldProps> = ({ color, shape, seed, size = 64, rotate = 0, className = '', style, title }) => {
  const s = shape ? HOLD_SHAPES.find((x) => x.id === shape) ?? HOLD_SHAPES[0] : seed ? holdShapeFor(seed) : randomHoldShape();
  const shadow = Math.max(1, Math.round(size / 16));
  return (
    <span
      className={`crux-hold crux-hold--${color} ${className}`.trim()}
      style={{ width: size, height: size, filter: `drop-shadow(0 ${shadow}px 0 var(--hardware-deep))`, transform: rotate ? `rotate(${rotate}deg)` : undefined, ...style }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <svg viewBox="0 0 100 100">
        <path className="crux-hold__body" d={s.d} />
        <path className="crux-hold__shade" d={s.shade} />
        <ellipse className="crux-hold__hi" cx={s.hi.cx} cy={s.hi.cy} rx={s.hi.rx} ry={s.hi.ry} transform={`rotate(${s.hi.rot} ${s.hi.cx} ${s.hi.cy})`} />
        <circle className="crux-hold__bolt" cx={s.bolt.cx} cy={s.bolt.cy} r={6} />
        <circle className="crux-hold__bolt-shine" cx={s.bolt.cx} cy={s.bolt.cy - 1.5} r={3.5} />
      </svg>
    </span>
  );
};

export default Hold;
