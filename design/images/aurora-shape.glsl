/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/** @sdf */
uniform sampler2D u_shape;

/**
 * How fast the colors move.
 * @label Speed
 * @default 0.2
 * @range 0, 2
 */
uniform float u_speed;

/**
 * @label Color 1
 * @color
 * @default #0d2b3e
 */
uniform vec3 u_color1;

/**
 * @label Color 2
 * @color
 * @default #1b6b5a
 */
uniform vec3 u_color2;

/**
 * @label Color 3
 * @color
 * @default #46c6c0
 */
uniform vec3 u_color3;

/**
 * @label Color 4
 * @color
 * @default #9b7fd4
 */
uniform vec3 u_color4;

/**
 * Direction the colors flow, in degrees.
 * @label Flow Direction
 * @default 45
 * @range 0, 360
 */
uniform float u_gradientAngle;

/**
 * How much the colors swirl and churn.
 * @label Turbulence
 * @default 0.6
 * @range 0, 2
 */
uniform float u_turbulence;

/**
 * Amount of fine detail in the swirls.
 * @label Detail
 * @default 0.55
 * @range 0, 2
 */
uniform float u_detail;

/**
 * How much the shape's edge warps the colors.
 * @label Edge Warp
 * @default 2.5
 * @range 0, 5
 */
uniform float u_edgeWarp;

/**
 * Brightness of the glowing rim around the shape.
 * @label Rim Glow
 * @default 0.22
 * @range 0, 1
 */
uniform float u_rim;

/**
 * @label Rim Color
 * @color
 * @default #cfe6ff
 */
uniform vec3 u_rimColor;

/**
 * How far the colors spread (only when Shape is 2).
 * @label Spread
 * @default 0.5
 * @range 0, 2
 */
uniform float u_spread;

const float GRAIN_AMOUNT = 0.04;
const float RIM_WIDTH = 0.03;
const float RIM_BEND = 0.06;
const float EDGE_DEPTH = 0.1;

float sceneSDF(vec2 p) {
  vec2 shapeUv = vec2(p.x / (u_resolution.x / u_resolution.y), p.y) + 0.5;
  float dist = texture2D(u_shape, shapeUv).r;
  return -dist / u_resolution.y;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float octave(vec2 p, float t) {
  float v = sin(p.x * 3.0 + t);
  v += sin(p.y * 3.7 - t * 0.8);
  v += sin((p.x + p.y) * 2.3 + t * 0.6);
  v += sin(length(p - 0.5) * 6.0 - t);
  return v * 0.25;
}

float fbm(vec2 p, float t) {
  float v = 0.0;
  float amp = 0.65;
  for (int i = 0; i < 3; i++) {
    v += octave(p, t) * amp;
    p *= 2.0;
    t *= 1.2;
    amp *= 0.5;
  }
  return v;
}

float flowField(vec2 p, float t, out float warp) {
  vec2 q = vec2(fbm(p, t), fbm(p + vec2(5.2, 1.3), t));
  vec2 r = vec2(fbm(p + 1.8 * q + vec2(1.7, 9.2), t * 0.6), fbm(p + 1.8 * q + vec2(8.3, 2.8), t * 0.6));
  warp = length(r);
  return fbm(p + 2.0 * r, t);
}

float ease(float x) {
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

vec3 paletteColor(float t) {
  float seg = fract(t) * 4.0;
  float f = ease(fract(seg));
  if (seg < 1.0) {
    return mix(u_color1, u_color2, f);
  }
  if (seg < 2.0) {
    return mix(u_color2, u_color3, f);
  }
  if (seg < 3.0) {
    return mix(u_color3, u_color4, f);
  }
  return mix(u_color4, u_color1, f);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  vec2 p = uv - 0.5;
  p.x *= u_resolution.x / u_resolution.y;

  float d = sceneSDF(p);
  float edge = sign(d) * (1.0 - exp(-abs(d) / EDGE_DEPTH)) * u_edgeWarp;

  float angle = radians(u_gradientAngle);
  vec2 dir = vec2(cos(angle), sin(angle));
  float gradient = dot(uv - 0.5, dir) + 0.5;

  float t = u_time * u_speed;
  vec2 drift = dir * 0.5 * t;
  float warp;
  float flow = flowField(uv * u_detail + drift + u_gradientAngle, t, warp) * u_turbulence;

  vec3 color = paletteColor(gradient * 0.3 + t + edge + flow);
  color += smoothstep(0.5, 1.4, warp) * 0.18 * vec3(0.9, 0.95, 1.0);
  color *= 0.78 + 0.22 * smoothstep(1.3, 0.0, warp);

  float aa = 2.0 / u_resolution.y;
  float mask = 1.0 - smoothstep(-aa, aa, d);

  float rim = smoothstep(-RIM_WIDTH, 0.0, d + flow * RIM_BEND);
  color += rim * rim * rim * u_rim * u_rimColor * mask;
  color += (hash(gl_FragCoord.xy) - 0.5) * GRAIN_AMOUNT;

  gl_FragColor = vec4(mix(u_color3, color, mask) * mask, mask);
}
