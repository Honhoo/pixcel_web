import { useEffect, useRef, type CSSProperties } from "react";
import * as THREE from "three";
import "./LiquidEther.css";

type LiquidEtherProps = {
  colors?: string[];
  mouseForce?: number;
  cursorSize?: number;
  resolution?: number;
  autoDemo?: boolean;
  autoSpeed?: number;
  autoIntensity?: number;
  className?: string;
  style?: CSSProperties;
};

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uMouse;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uIntensity;
uniform float uCursorSize;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + 7.17;
    a *= 0.52;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= 1.55;

  vec2 flow = vec2(
    fbm(p * 1.18 + vec2(uTime * 0.045, -uTime * 0.025)),
    fbm(p * 1.34 + vec2(-uTime * 0.032, uTime * 0.052))
  );
  vec2 warped = p + (flow - 0.5) * 0.62;

  float ribbons =
    sin((warped.x * 2.8 + warped.y * 1.3 + uTime * 0.46) + fbm(warped * 2.0) * 3.2) * 0.5 + 0.5;
  float clouds = fbm(warped * 2.4 + flow * 1.8);
  float liquid = smoothstep(0.24, 0.94, ribbons * 0.58 + clouds * 0.72);

  float mouseGlow = 0.0;
  if (uMouse.x > -1.5) {
    float d = distance(uv, uMouse);
    mouseGlow = smoothstep(uCursorSize, 0.0, d) * uIntensity;
  }

  vec3 color = mix(uColor0, uColor1, liquid);
  color = mix(color, uColor2, smoothstep(0.55, 1.0, clouds + mouseGlow * 0.28));
  float alpha = smoothstep(0.12, 1.0, liquid + mouseGlow * 0.55) * 0.42;

  gl_FragColor = vec4(color, alpha);
}
`;

function LiquidEther({
  colors = ["#122400", "#3b7800", "#b6ff00"],
  mouseForce = 15,
  cursorSize = 75,
  resolution = 0.75,
  autoDemo = true,
  autoSpeed = 0.28,
  autoIntensity = 1.8,
  className = "",
  style,
}: LiquidEtherProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef(new THREE.Vector2(-2, -2));
  const targetMouseRef = useRef(new THREE.Vector2(-2, -2));

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: mouseRef.current },
        uColor0: { value: new THREE.Color(colors[0]) },
        uColor1: { value: new THREE.Color(colors[1] ?? colors[0]) },
        uColor2: { value: new THREE.Color(colors[2] ?? colors[1] ?? colors[0]) },
        uIntensity: { value: autoIntensity },
        uCursorSize: { value: cursorSize / 1000 },
      },
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    mount.appendChild(renderer.domElement);

    let frame = 0;
    let visible = true;
    const clock = new THREE.Clock();

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * resolution;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      targetMouseRef.current.set((event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height);
      material.uniforms.uIntensity.value = mouseForce / 8;
    };

    const animate = () => {
      if (!visible) return;
      const elapsed = clock.getElapsedTime();
      material.uniforms.uTime.value = elapsed;

      if (autoDemo && targetMouseRef.current.x < -1.5) {
        targetMouseRef.current.set(
          0.5 + Math.sin(elapsed * autoSpeed) * 0.32,
          0.5 + Math.cos(elapsed * autoSpeed * 1.37) * 0.24,
        );
        material.uniforms.uIntensity.value = autoIntensity;
      }

      mouseRef.current.lerp(targetMouseRef.current, 0.08);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) {
        clock.start();
        frame = requestAnimationFrame(animate);
      } else if (!visible && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });

    const resizeObserver = new ResizeObserver(resize);
    resize();
    resizeObserver.observe(mount);
    observer.observe(mount);
    mount.addEventListener("pointermove", onPointerMove);
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      mount.removeEventListener("pointermove", onPointerMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [autoDemo, autoIntensity, autoSpeed, colors, cursorSize, mouseForce, resolution]);

  return <div ref={mountRef} className={`liquid-ether-container ${className}`} style={style} />;
}

export default LiquidEther;
