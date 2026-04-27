import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uPlaying;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
           (c - a) * u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.55;

    for (int i = 0; i < 7; i++) {
      value += amp * noise(p);
      p *= 2.03;
      amp *= 0.52;
    }

    return value;
  }

  float fogBand(vec2 uv, float time, float offset, float density, float amp) {
    vec2 p = uv;
    p.x += offset;
    p.y += sin(p.x * 1.2 + time * 0.16 + offset * 5.0) * 0.12;
    p.y += sin(p.x * 2.4 - time * 0.09 + offset * 2.0) * 0.05;

    float n1 = fbm(p * vec2(1.4, 3.8) + vec2(time * 0.035, -time * 0.02));
    float n2 = fbm(p * vec2(2.8, 5.6) + vec2(-time * 0.018, time * 0.026));
    float field = mix(n1, n2, 0.42);

    float band = 1.0 - abs(uv.y - 0.48 - field * amp);
    band = smoothstep(density, 1.0, band);

    return band;
  }

  vec3 auroraVolume(vec2 uv, vec2 pointer, float time) {
    vec3 c1 = vec3(0.12, 0.95, 0.82);
    vec3 c2 = vec3(0.09, 0.62, 0.98);
    vec3 c3 = vec3(0.28, 0.95, 0.88);
    vec3 c4 = vec3(0.16, 0.12, 0.30);

    vec2 pFar = uv + pointer * vec2(0.10, 0.04);
    vec2 pMid = uv + pointer * vec2(0.18, 0.08);
    vec2 pNear = uv + pointer * vec2(0.28, 0.12);

    float farFog  = fogBand(pFar,  time * 0.72,  0.16, 0.16, 0.26);
    float midFog  = fogBand(pMid,  time * 0.96, -0.08, 0.12, 0.34);
    float nearFog = fogBand(pNear, time * 1.18,  0.24, 0.08, 0.42);

    float farMist = fbm(pFar * vec2(2.0, 2.6) + vec2(time * 0.015, -time * 0.012));
    float midMist = fbm(pMid * vec2(2.8, 3.6) + vec2(-time * 0.02, time * 0.014));
    float nearMist = fbm(pNear * vec2(3.6, 4.4) + vec2(time * 0.03, -time * 0.022));

    farFog *= smoothstep(0.32, 0.92, farMist);
    midFog *= smoothstep(0.28, 0.94, midMist);
    nearFog *= smoothstep(0.22, 0.98, nearMist);

    vec3 farColor = mix(c4, c2, clamp(uv.x + farMist * 0.22, 0.0, 1.0));
    vec3 midColor = mix(c1, c2, clamp(uv.x + midMist * 0.18, 0.0, 1.0));
    vec3 nearColor = mix(c3, c1, clamp(uv.x + nearMist * 0.14, 0.0, 1.0));

    vec3 color = vec3(0.0);
    color += farColor * farFog * 0.42;
    color += midColor * midFog * 0.68;
    color += nearColor * nearFog * 0.96;

    return color;
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv - 0.5;
    centered.x *= uResolution.x / max(uResolution.y, 1.0);

    float time = uTime * (0.88 + uPlaying * 0.2);
    vec2 pointer = uPointer;

    vec3 bg = vec3(0.012, 0.026, 0.046);

    vec2 drift = uv;
    drift.x += sin(uv.y * 2.8 + time * 0.10) * 0.018;
    drift.y += sin(uv.x * 2.1 + time * 0.14) * 0.028;

    vec3 volume = auroraVolume(drift, pointer, time);

    float radialGlow = 0.24 / (length(centered - pointer * vec2(0.20, 0.10)) * 3.0 + 0.55);
    float upperGlow = 0.18 / (length(centered - vec2(0.0, 0.22) - pointer * 0.08) * 3.8 + 0.7);

    float deepHaze = fbm(drift * vec2(1.5, 1.8) + vec2(time * 0.01, -time * 0.012));
    deepHaze = smoothstep(0.30, 0.96, deepHaze) * 0.14;

    vec3 color = bg;
    color += volume;
    color += vec3(0.10, 0.34, 0.30) * radialGlow * (0.75 + uPlaying * 0.28);
    color += vec3(0.05, 0.14, 0.22) * upperGlow;
    color += vec3(0.05, 0.14, 0.16) * deepHaze;

    float vignette = smoothstep(1.30, 0.18, length(centered * vec2(0.88, 1.16)));
    color *= vignette;

    color = pow(color, vec3(0.92));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function AuroraBackground({ isPlaying = false }) {
  const mountRef = useRef(null);
  const playingTargetRef = useRef(isPlaying ? 1 : 0);

  useEffect(() => {
    playingTargetRef.current = isPlaying ? 1 : 0;
  }, [isPlaying]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    mount.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uPlaying: { value: playingTargetRef.current },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const pointer = new THREE.Vector2(0, 0);
    const smoothPointer = new THREE.Vector2(0, 0);
    const clock = new THREE.Clock();

    function handlePointerMove(event) {
      const x = event.clientX / window.innerWidth;
      const y = event.clientY / window.innerHeight;

      pointer.x = (x - 0.5) * 2.0;
      pointer.y = (0.5 - y) * 2.0;
    }

    function handleResize() {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("resize", handleResize);

    let frameId = 0;

    const renderLoop = () => {
      frameId = requestAnimationFrame(renderLoop);

      uniforms.uTime.value = clock.getElapsedTime();
      uniforms.uPlaying.value +=
        (playingTargetRef.current - uniforms.uPlaying.value) * 0.04;

      smoothPointer.lerp(pointer, 0.045);
      uniforms.uPointer.value.copy(smoothPointer);

      renderer.render(scene, camera);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(frameId);

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);

      geometry.dispose();
      material.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="aurora-canvas" aria-hidden="true" />;
}
