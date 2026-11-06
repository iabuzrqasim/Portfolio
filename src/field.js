// One WebGL point field that runs through the whole site.
// It holds exactly one point per order in the Power BI dataset and morphs between shapes.
(() => {
  const canvas = document.querySelector(".field");
  if (!canvas) return;

  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
  if (!gl) {
    document.documentElement.classList.add("no-webgl");
    return;
  }

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Orders per region, from the report's data model: Midwest, West, South, Northeast.
  // These total 20,960.
  // Touch devices draw a lighter field with the same proportions.
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const REGIONS = [5838, 5140, 5010, 4972].map((value) => Math.round(value * (fine ? 1 : 0.4)));
  const COUNT = REGIONS.reduce((sum, value) => sum + value, 0);

  let seed = 20960;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const build = (fn) => {
    const data = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const [x, y, z] = fn(i);
      data[i * 3] = x;
      data[i * 3 + 1] = y;
      data[i * 3 + 2] = z;
    }
    return data;
  };

  // Stage 0: raw data, a restless orb
  const orb = (i) => {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = i * 2.399963;
    const x = Math.cos(theta) * ring;
    const z = Math.sin(theta) * ring;
    const lump = Math.sin(x * 3.1 + 1) * Math.cos(y * 2.7) * Math.sin(z * 3.3 + 2);
    const r = 1.75 + lump * 0.34 + (rand() - 0.5) * 0.2;
    return [x * r, y * r, z * r];
  };

  // Stage 1: an ordered terrain
  const columnsWide = Math.ceil(Math.sqrt(COUNT * 1.6));
  const terrain = (i) => {
    const gx = i % columnsWide;
    const gz = Math.floor(i / columnsWide);
    const x = (gx / columnsWide - 0.5) * 6.4;
    const z = (gz / (COUNT / columnsWide) - 0.5) * 4.2;
    const y = Math.sin(x * 0.9) * Math.cos(z * 1.1) * 0.5 + Math.sin(x * 2.3 + z * 1.7) * 0.14;
    return [x, y, z];
  };

  // Stage 2: a structured lattice
  const lattice = () => {
    const steps = 5;
    const size = 2.7;
    const axis = Math.floor(rand() * 3);
    const a = (Math.floor(rand() * steps) / (steps - 1) - 0.5) * size;
    const b = (Math.floor(rand() * steps) / (steps - 1) - 0.5) * size;
    const c = (rand() - 0.5) * size;
    return axis === 0 ? [c, a, b] : axis === 1 ? [a, c, b] : [a, b, c];
  };

  // Stage 3: four columns. Each holds its region's real order count at equal density.
  const starts = [];
  REGIONS.reduce((sum, value, index) => ((starts[index] = sum), sum + value), 0);
  const regionOf = (i) => {
    for (let r = REGIONS.length - 1; r >= 0; r--) if (i >= starts[r]) return r;
    return 0;
  };
  const columns = (i) => {
    const r = regionOf(i);
    const height = (3.3 * REGIONS[r]) / REGIONS[0];
    const x = (r - 1.5) * 1.15;
    return [x + (rand() - 0.5) * 0.66, -1.65 + rand() * height, (rand() - 0.5) * 0.66];
  };

  // Stage 4: an app wireframe
  const blocks = [
    [-0.62, 1.15, 1.24, 0.22], [-0.62, 0.62, 1.24, 0.34],
    [-0.62, 0.08, 0.36, 0.36], [-0.18, 0.08, 0.36, 0.36], [0.26, 0.08, 0.36, 0.36],
    [-0.62, -0.42, 0.36, 0.36], [-0.18, -0.42, 0.36, 0.36], [0.26, -0.42, 0.36, 0.36],
    [-0.62, -1.08, 1.24, 0.46],
  ];
  const phone = () => {
    const w = 1.7;
    const h = 3.4;
    const pick = rand();
    if (pick < 0.42) {
      const along = rand() * 2 * (w + h);
      let x;
      let y;
      if (along < w) [x, y] = [along - w / 2, h / 2];
      else if (along < w + h) [x, y] = [w / 2, h / 2 - (along - w)];
      else if (along < 2 * w + h) [x, y] = [w / 2 - (along - w - h), -h / 2];
      else [x, y] = [-w / 2, -h / 2 + (along - 2 * w - h)];
      return [x + (rand() - 0.5) * 0.03, y + (rand() - 0.5) * 0.03, (rand() - 0.5) * 0.16];
    }
    const [bx, by, bw, bh] = blocks[Math.floor(rand() * blocks.length)];
    return [bx + rand() * bw, by + rand() * bh, (rand() - 0.5) * 0.05];
  };

  // Stage 5: a ring for the closing section
  const ring = (i) => {
    const a = (i / COUNT) * Math.PI * 2 * 37;
    const b = rand() * Math.PI * 2;
    const tube = 0.2 + 0.2 * Math.sin(a * 3) * Math.sin(a * 3);
    const r = 1.9 + Math.cos(b) * tube;
    return [Math.cos(a) * r, Math.sin(a) * r, Math.sin(b) * tube];
  };

  // In page order: hero, projects, Maharat, projects, skills, about, contact.
  const shapes = [orb, columns, phone, columns, lattice, terrain, ring].map(build);
  const meta = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) {
    meta[i * 2] = rand();
    meta[i * 2 + 1] = regionOf(i) === 0 ? 1 : 0;
  }

  const vertex = `
    attribute vec3 aFrom;
    attribute vec3 aTo;
    attribute vec2 aMeta;
    uniform float uMix, uTime, uAspect, uScale, uSize, uAlpha, uIntro, uWave, uHi, uShift, uLift, uPush;
    uniform vec2 uMouse, uRot;
    varying vec4 vColor;

    vec3 rotate(vec3 p, vec2 r) {
      float cy = cos(r.y), sy = sin(r.y), cx = cos(r.x), sx = sin(r.x);
      p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
      return vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
    }

    void main() {
      float s = aMeta.x;
      float t = smoothstep(s * 0.45, s * 0.45 + 0.55, uMix);
      vec3 p = mix(aFrom, aTo, t);
      float swirl = sin(3.14159 * t);
      p += swirl * 0.5 * vec3(sin(s * 91.0 + uTime * 0.7), cos(s * 53.0 + uTime * 0.6), sin(s * 37.0 - uTime * 0.5));
      p += 0.05 * vec3(sin(p.y * 2.1 + uTime * 0.6 + s * 6.0), cos(p.z * 1.9 + uTime * 0.5), sin(p.x * 2.3 - uTime * 0.4));
      p.y += uWave * 0.2 * sin(p.x * 1.5 + uTime * 0.7) * cos(p.z * 1.3 - uTime * 0.5);
      p *= mix(2.6 + s * 3.0, 1.0, uIntro);
      p = rotate(p, uRot) * uScale;
      p.x += uShift;
      p.y += uLift;

      vec2 d = p.xy - uMouse;
      float r2 = dot(d, d);
      p.xy += normalize(d + 0.0001) * 0.5 * exp(-r2 * 2.4) * uPush;

      float z = 7.0 - p.z;
      float light = clamp((p.z + 2.6) / 5.2, 0.0, 1.0);
      vec3 color = mix(vec3(0.96, 0.93, 0.98), vec3(0.545, 0.361, 0.965), smoothstep(0.32, 0.66, s));
      color = mix(color, vec3(0.961, 0.647, 0.141), step(0.94, s));
      vColor = vec4(color, uAlpha * uIntro * (0.34 + 0.66 * light));
      gl_Position = vec4(p.x * 2.2 / uAspect, p.y * 2.2, 0.0, z);
      gl_PointSize = uSize * (0.75 + s * 0.6) * 7.0 / z;
    }`;

  const fragment = `
    precision mediump float;
    varying vec4 vColor;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.12, d);
      gl_FragColor = vec4(vColor.rgb * vColor.a * a, vColor.a * a);
    }`;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    document.documentElement.classList.add("no-webgl");
    return;
  }
  gl.useProgram(program);

  const buffers = shapes.map((data) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  });
  const metaBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, metaBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, meta, gl.STATIC_DRAW);

  const aFrom = gl.getAttribLocation(program, "aFrom");
  const aTo = gl.getAttribLocation(program, "aTo");
  const aMeta = gl.getAttribLocation(program, "aMeta");
  [aFrom, aTo, aMeta].forEach((location) => gl.enableVertexAttribArray(location));
  gl.vertexAttribPointer(aMeta, 2, gl.FLOAT, false, 0, 0);

  const uniform = {};
  ["uMix", "uTime", "uAspect", "uScale", "uSize", "uAlpha", "uIntro", "uWave", "uHi", "uShift", "uLift", "uPush", "uMouse", "uRot"]
    .forEach((name) => { uniform[name] = gl.getUniformLocation(program, name); });

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  // Per-stage camera pose: tilt, how much the fixed angle replaces free rotation, and that angle
  const TILT = [0.2, 0.1, 0, 0.1, 0.38, 0.62, 0.2];
  const FIXED = [0, 1, 1, 1, 0, 1, 1];
  const ANGLE = [0, -0.2, -0.32, -0.2, 0, 0.35, 0.3];
  const lerpTable = (table, stage) => {
    const i = Math.min(Math.floor(stage), table.length - 2);
    return table[i] + (table[i + 1] - table[i]) * (stage - i);
  };

  const state = { stage: 0, shift: 0, lift: 0, alpha: 1, intro: reduced ? 1 : 0, hi: 0, paused: false };
  const current = { stage: 0, shift: 0, lift: 0, alpha: 1, hi: 0, mx: 0, my: 0, px: 0, py: 0 };
  const pointer = { x: 0, y: 0, active: 0 };

  let aspect = 1;
  let dprCap = Math.min(window.devicePixelRatio || 1, innerWidth < 760 ? 1.25 : 1.5);

  const resize = () => {
    const width = canvas.clientWidth || innerWidth;
    const height = canvas.clientHeight || innerHeight;
    canvas.width = Math.round(width * dprCap);
    canvas.height = Math.round(height * dprCap);
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = width / height;
    gl.uniform1f(uniform.uAspect, aspect);
    gl.uniform1f(uniform.uScale, Math.min(1, Math.max(0.62, aspect / 1.15)));
    gl.uniform1f(uniform.uSize, 2.1 * dprCap);
    draw(performance.now());
  };

  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    addEventListener("pointermove", (event) => {
      pointer.x = (event.clientX / innerWidth) * 2 - 1;
      pointer.y = -((event.clientY / innerHeight) * 2 - 1);
      pointer.active = 1;
    }, { passive: true });
  }

  let spin = 0;
  let last = performance.now();
  let slowFrames = 0;
  let sampled = 0;

  function draw(now) {
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    const ease = reduced ? 1 : 1 - Math.pow(0.002, delta);
    current.stage += (state.stage - current.stage) * ease;
    current.shift += (state.shift - current.shift) * ease;
    current.lift += (state.lift - current.lift) * ease;
    current.alpha += (state.alpha - current.alpha) * ease;
    if (!reduced) state.intro = Math.min(1, state.intro + delta * 0.6);
    current.px += (pointer.x - current.px) * (reduced ? 0 : ease * 0.6);
    current.py += (pointer.y - current.py) * (reduced ? 0 : ease * 0.6);
    current.mx = (current.px * aspect * 7) / 2.2;
    current.my = (current.py * 7) / 2.2;

    const stage = Math.max(0, Math.min(current.stage, shapes.length - 1));
    const index = Math.min(Math.floor(stage), shapes.length - 2);
    if (!reduced) spin = (spin + delta * 0.14) % (Math.PI * 2);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[index]);
    gl.vertexAttribPointer(aFrom, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[index + 1]);
    gl.vertexAttribPointer(aTo, 3, gl.FLOAT, false, 0, 0);

    const fixed = lerpTable(FIXED, stage);
    const rotY = spin * (1 - fixed) + lerpTable(ANGLE, stage) * fixed + current.px * 0.16;
    const rotX = lerpTable(TILT, stage) - current.py * 0.1;

    gl.uniform1f(uniform.uMix, stage - index);
    gl.uniform1f(uniform.uTime, reduced ? 0 : now / 1000);
    gl.uniform1f(uniform.uAlpha, current.alpha * 0.8);
    gl.uniform1f(uniform.uIntro, state.intro);
    gl.uniform1f(uniform.uWave, Math.max(0, 1 - Math.abs(stage - 1)));
    gl.uniform1f(uniform.uHi, 0);
    gl.uniform1f(uniform.uShift, current.shift);
    gl.uniform1f(uniform.uLift, current.lift);
    gl.uniform1f(uniform.uPush, pointer.active && !reduced ? 1 : 0);
    gl.uniform2f(uniform.uMouse, current.mx, current.my);
    gl.uniform2f(uniform.uRot, rotX, rotY);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, COUNT);
  }

  // Lower the resolution once if a device struggles
  const watchFrame = (delta) => {
    if (dprCap <= 1 || sampled > 240) return;
    sampled++;
    if (delta > 30) slowFrames++;
    if (sampled === 120 && slowFrames > 60) {
      dprCap = 1;
      resize();
    }
  };

  let previous = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (document.hidden || state.paused) {
      previous = now;
      last = now;
      return;
    }
    watchFrame(now - previous);
    previous = now;
    draw(now);
  };

  addEventListener("resize", resize);
  resize();

  // Scroll drives the shape. Each section's top is where the next shape takes over.
  const fixedStage = document.body.dataset.fieldStage;
  const anchors = ["#work", "#maharat", "#maharat + .project", "#skills", "#about", "#contact"].map((selector) => document.querySelector(selector));
  const darkArea = document.querySelector(".hero, .page-hero");
  let tops = [];
  const measure = () => {
    tops = anchors.filter(Boolean).map((element) => element.getBoundingClientRect().top + scrollY);
  };
  const follow = () => {
    const middle = scrollY + innerHeight * 0.6;
    const stage = fixedStage ? Number(fixedStage) : tops.reduce((sum, top) => sum + Math.min(Math.max((middle - top) / (innerHeight * 0.5) + 0.5, 0), 1), 0);
    const overHero = darkArea.getBoundingClientRect().bottom > innerHeight * 0.45;
    state.stage = stage;
    // The orb sits behind the photo on wide screens.
    const wide = innerWidth > 820;
    const reach = 0.5 * 7 * (innerWidth / innerHeight) / 2.2;
    state.shift = !wide ? 0 : fixedStage ? reach * 1.1 : Math.max(0, 1 - stage) * reach * 0.92;
    // On phones the orb rises behind the photo, clear of the text.
    state.lift = wide || fixedStage ? 0 : Math.max(0, 1 - stage) * 1.45;
    state.alpha = overHero ? (wide ? 0.8 : 0.5) : 0.3;
  };

  measure();
  follow();
  Object.assign(current, { stage: state.stage, shift: state.shift, lift: state.lift, alpha: state.alpha });
  new ResizeObserver(measure).observe(document.body);

  if (reduced) {
    // Still image only: one frame, redrawn only when the window size changes.
    draw(performance.now());
  } else {
    addEventListener("scroll", follow, { passive: true });
    addEventListener("resize", follow);
    requestAnimationFrame(loop);
  }
})();
