import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';

const PARTICLE_COUNT = 45;
const CAMERA_DIST = 380;
const RADIUS_X = 145;
const RADIUS_Y = 160;
const RADIUS_Z = 120;

export default function Sparkler3D({ width = 340, height = 380, accentColor = '#A855F7', active = true }) {
  const [particles, setParticles] = useState([]);
  const frameRef = useRef(null);
  const stateRef = useRef([]);

  // Initialize 3D particles with random positions on a 3D orbital shell
  useEffect(() => {
    const initial = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const speed = 0.008 + Math.random() * 0.014;
      const size = 2 + Math.random() * 3.5;
      const brightness = 0.4 + Math.random() * 0.6;
      const sparkFreq = 2 + Math.random() * 4;

      initial.push({
        theta,
        phi,
        speed,
        baseSize: size,
        brightness,
        sparkFreq,
        tailLength: 6 + Math.random() * 12,
        colorVariant: i % 4 === 0 ? '#FFFFFF' : (i % 3 === 0 ? '#C084FC' : accentColor)
      });
    }
    stateRef.current = initial;
  }, [accentColor]);

  useEffect(() => {
    if (!active) return;

    let time = 0;
    const centerX = width / 2;
    const centerY = height / 2;

    const animate = () => {
      time += 0.016;
      const current = stateRef.current;
      const projected = [];

      for (let i = 0; i < current.length; i++) {
        const p = current[i];
        p.theta += p.speed;

        // True 3D orbital coordinates
        const x = Math.cos(p.theta) * Math.cos(p.phi) * RADIUS_X;
        const y = Math.sin(p.phi) * RADIUS_Y + Math.sin(p.theta * 2 + time) * 15;
        const z = Math.sin(p.theta) * Math.cos(p.phi) * RADIUS_Z;

        // Perspective 3D camera projection
        const scale = CAMERA_DIST / (CAMERA_DIST + z);
        const px = centerX + x * scale;
        const py = centerY + y * scale;

        // Depth-based size and opacity attenuation
        const depthNorm = (z + RADIUS_Z) / (2 * RADIUS_Z); // 0 (back) to 1 (front)
        const twinkle = 0.7 + 0.3 * Math.sin(time * p.sparkFreq + p.theta);
        const opacity = Math.min(1, Math.max(0.15, (0.3 + depthNorm * 0.7) * p.brightness * twinkle));
        const size = Math.max(1, p.baseSize * scale * (0.8 + 0.4 * depthNorm));

        // Motion trail calculations
        const prevTheta = p.theta - p.speed * 2.5;
        const prevX = Math.cos(prevTheta) * Math.cos(p.phi) * RADIUS_X;
        const prevY = Math.sin(p.phi) * RADIUS_Y;
        const prevZ = Math.sin(prevTheta) * Math.cos(p.phi) * RADIUS_Z;
        const prevScale = CAMERA_DIST / (CAMERA_DIST + prevZ);
        const tailX = centerX + prevX * prevScale;
        const tailY = centerY + prevY * prevScale;

        projected.push({
          id: i,
          x: px,
          y: py,
          tailX,
          tailY,
          size,
          opacity,
          z, // for depth sorting
          color: p.colorVariant
        });
      }

      // Sort by Z so closer particles render on top of farther ones
      projected.sort((a, b) => a.z - b.z);
      setParticles(projected);

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [width, height, active]);

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="sparkGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="50%" stopColor={accentColor} stopOpacity="0.8" />
            <Stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {particles.map((pt) => (
          <React.Fragment key={pt.id}>
            {/* Sparkler Tail Streak */}
            <Line
              x1={pt.tailX}
              y1={pt.tailY}
              x2={pt.x}
              y2={pt.y}
              stroke={pt.color}
              strokeWidth={Math.max(1, pt.size * 0.55)}
              strokeOpacity={pt.opacity * 0.5}
              strokeLinecap="round"
            />
            {/* Core Sparkler Glow */}
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={pt.size * 1.5}
              fill={pt.color}
              opacity={pt.opacity * 0.35}
            />
            {/* Core Hot Spark */}
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={Math.max(1.2, pt.size * 0.75)}
              fill="#FFFFFF"
              opacity={pt.opacity}
            />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1
  }
});
