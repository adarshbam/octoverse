import * as THREE from 'three';

/**
 * A technology orb's glass, as in panel 3: a dark, clear interior that holds the scene behind it
 * back; a crisp Fresnel edge in the logo's own colour, picking up the surroundings in distinct
 * colours (purple above, orange from the lava below, blue on the left); and sharp near-white
 * highlights as short arcs along the rim, outside the logo: a long one up left from the key
 * light, short dashes up right, low right and low left. `uOpacity` fades it in with the overview.
 */
/** The hot red-pink ring a technology's orb glows with while it is in focus (panel 4). */
export const ORB_FOCUS_COLOUR = '#ff2e5a';

export function createOrbMaterial(tint: string) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: new THREE.Color(tint) },
      uOpacity: { value: 0 },
      /** How far the orb is in focus (0..1): its edge turns to ORB_FOCUS_COLOUR and brightens. */
      uFocus: { value: 0 },
      uFocusColour: { value: new THREE.Color(ORB_FOCUS_COLOUR) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vLocal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - world.xyz);
        vLocal = position;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      uniform float uOpacity;
      uniform float uFocus;
      uniform vec3 uFocusColour;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vLocal;

      // An arc of the rim centred at angle c (radians round the orb, 0 to the right), half-width w.
      float arc(float a, float c, float w) {
        float d = abs(atan(sin(a - c), cos(a - c)));
        return 1.0 - smoothstep(w * 0.55, w, d);
      }

      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(vV);
        float ndv = clamp(dot(N, V), 0.0, 1.0);

        // The surroundings round the edge, in distinct colours, mostly the logo's own.
        vec3 env = mix(vec3(1.0, 0.42, 0.12), vec3(0.62, 0.36, 1.0), smoothstep(-0.55, 0.55, N.y));
        env = mix(env, vec3(0.25, 0.55, 1.0), smoothstep(0.25, 0.9, -N.x) * smoothstep(0.6, -0.2, N.y) * 0.7);
        env = mix(env, uTint, 0.8);
        // In focus, the edge glows hot red-pink.
        env = mix(env, uFocusColour, uFocus * 0.85);

        // Fresnel: a dark, clear centre with a faint glow of the logo's colour, a saturated ring in
        // the logo's colour (as painted: red round HTML, blue round CSS, green round Node), and a
        // thin brighter line at the very edge that stays coloured rather than turning white.
        // Colours here are linear and brightened by the final sRGB encode, so the centre is very dark.
        float fresnel = pow(1.0 - ndv, 7.0);
        // Bright ring colours (white, yellow) are held to the luminance of a saturated red, so the
        // threshold bloom does not haze their glass.
        float ringLevel = min(1.0, 0.3 / max(dot(env, vec3(0.2126, 0.7152, 0.0722)), 1e-3));
        // In focus the ring thickens and brightens into the painting's bold neon circle.
        float ring = pow(1.0 - ndv, 5.0 - 1.4 * uFocus) * 1.9 * ringLevel * (1.0 + 1.9 * uFocus);
        vec3 col = uTint * 0.006 + vec3(0.002, 0.0015, 0.004) + env * ring + env * fresnel * 1.2 * ringLevel
          + env * pow(1.0 - ndv, 2.5) * 0.18 * ringLevel
          + mix(env, vec3(1.0), 0.25) * pow(1.0 - ndv, 18.0) * 0.9;

        // Highlights: short near-white arcs along the rim, just inside the edge, outside the logo.
        float a = atan(vLocal.y, vLocal.x);
        float band = smoothstep(0.06, 0.12, ndv) * (1.0 - smoothstep(0.24, 0.33, ndv));
        float arcs = arc(a, 2.2, 0.42) + arc(a, 0.82, 0.12) + arc(a, 0.5, 0.06) + arc(a, -0.9, 0.1) + arc(a, 3.6, 0.07);
        // Bright enough to read as near-white, not so bright that the bloom hazes the glass.
        float shine = band * arcs * 1.25;
        col += vec3(1.0) * shine;

        // The interior holds most of the scene behind it back, so the orb never melts into it.
        float alpha = clamp(0.72 + fresnel * 0.4 + shine, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    // Nox's skin writes depth, so a bubble on the far side of his head or arms would be cut away by
    // it: bubbles always show in front (TechBubbles draws them after all of his layers).
    depthTest: false,
  });
}

/**
 * A bubble's logo, a plane in front of its glass. At its plain brightness, so the bloom does not
 * haze the glass round it, and unfogged (a world's water fog must not tint it). Like the glass, it
 * ignores Nox's depth.
 */
export function createOrbLogoMaterial(map: THREE.Texture) {
  return new THREE.MeshBasicMaterial({ map, color: new THREE.Color(1, 1, 1), transparent: true, depthWrite: false, depthTest: false, fog: false });
}

/** How far the halo shell reaches beyond the orb, as a multiple of the orb's radius. */
export const ORB_HALO_SCALE = 1.16;

/**
 * The soft glow just outside an orb's edge, in the logo's colour, as painted round every orb: the
 * back faces of a shell ORB_HALO_SCALE times the orb, added to the scene, brightest at the orb's
 * outline and gone at the shell's. Bright colours are held back as on the glass ring, so the
 * threshold bloom does not pick them up.
 */
export function createOrbHaloMaterial(tint: string) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: new THREE.Color(tint) },
      uFocus: { value: 0 },
      uFocusColour: { value: new THREE.Color(ORB_FOCUS_COLOUR) },
      uOpacity: { value: 0 },
      uEdge: { value: Math.sqrt(1 - 1 / (ORB_HALO_SCALE * ORB_HALO_SCALE)) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      uniform float uOpacity;
      uniform float uEdge;
      uniform float uFocus;
      uniform vec3 uFocusColour;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        // Back faces: the normal points away from the camera, so flip it to measure the view angle.
        float ndv = clamp(dot(-normalize(vN), normalize(vV)), 0.0, 1.0);
        // 0 at the shell's outline, 1 at the orb's outline (and behind the orb).
        float t = clamp(ndv / uEdge, 0.0, 1.0);
        float glow = t * t * t;
        // Behind the orb itself only a little shows, so its centre stays dark (most of all in focus).
        glow *= 1.0 - 0.75 * smoothstep(uEdge, uEdge + 0.12, ndv);
        vec3 tint = mix(uTint, uFocusColour, uFocus);
        float level = min(1.0, 0.3 / max(dot(tint, vec3(0.2126, 0.7152, 0.0722)), 1e-3));
        gl_FragColor = vec4(tint * glow * 0.55 * level * (1.0 + 1.4 * uFocus) * uOpacity, 1.0);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
}
