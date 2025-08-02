import React from 'react';

// Vertex 좌표를 미리 정의 (상대적 위치 % 기준)
const vertices = [
  { id: 'X', x: '5%', y: '50%', color: '#ff4d4d' },
  { id: 'Y', x: '95%', y: '50%', color: '#4d79ff' },
  { id: 'X1', x: '15%', y: '15%', color: '#999' },
  { id: 'X2', x: '15%', y: '85%', color: '#999' },
  { id: 'X3', x: '85%', y: '15%', color: '#999' },
  { id: 'X4', x: '85%', y: '85%', color: '#999' },
  { id: 'Y1', x: '30%', y: '30%', color: '#bbb' },
  { id: 'Y2', x: '30%', y: '70%', color: '#bbb' },
  { id: 'Y3', x: '70%', y: '30%', color: '#bbb' },
  { id: 'Y4', x: '70%', y: '70%', color: '#bbb' },
  { id: 'M1', x: '50%', y: '20%', color: '#ccc' },
  { id: 'M2', x: '50%', y: '50%', color: '#ccc' },
  { id: 'M3', x: '50%', y: '80%', color: '#ccc' },
  { id: 'S1', x: '25%', y: '10%', color: '#ffcc00' },
  { id: 'S2', x: '25%', y: '90%', color: '#ffcc00' },
  { id: 'S3', x: '75%', y: '10%', color: '#ffcc00' },
  { id: 'S4', x: '75%', y: '90%', color: '#ffcc00' },
];

export default function ToyBattleMap() {
  return (
    <div
      style={{
        position: 'relative',
        width: '800px',
        height: '500px',
        backgroundImage: 'url(/map-background.png)', // 실제 맵 이미지 경로
        backgroundSize: 'cover',
        border: '3px solid #333',
        borderRadius: '12px',
      }}
    >
      {vertices.map((v) => (
        <div
          key={v.id}
          style={{
            position: 'absolute',
            left: v.x,
            top: v.y,
            transform: 'translate(-50%, -50%)',
            width: '40px',
            height: '40px',
            backgroundColor: v.color,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            color: '#fff',
            boxShadow: '0 0 5px rgba(0,0,0,0.5)',
          }}
        >
          {v.id}
        </div>
      ))}
    </div>
  );
}
