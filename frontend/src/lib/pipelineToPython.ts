/**
 * Generate OpenCV (Python) source from a validated pipeline: `img` → `out`.
 * Mirrors the backend semantics closely; GLCM/LBP are lengthy — included as runnable numpy.
 */

function flt(v: unknown, d: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : d
}

function intg(v: unknown, d: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isFinite(n) ? Math.trunc(n) : d
}

function pyVal(v: unknown): string {
  if (v === null || v === undefined) return 'None'
  if (typeof v === 'boolean') return v ? 'True' : 'False'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  if (typeof v === 'string') return JSON.stringify(v)
  return JSON.stringify(v)
}

function pyDict(p: Record<string, unknown>): string {
  const keys = Object.keys(p)
  if (keys.length === 0) return '{}'
  return `{ ${keys.map((k) => `${JSON.stringify(k)}: ${pyVal(p[k])}`).join(', ')} }`
}

/** One pipeline step → Python lines (assigns to `out`). */
function emitStep(op: string, params: Record<string, unknown>, stepNo: number): string {
  const p = params
  const hdr = `# --- Step ${stepNo}: ${op}`

  switch (op) {
    case 'normalize_minmax': {
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_gray = cv2.normalize(_gray, None, 0, 255, cv2.NORM_MINMAX)
out = cv2.cvtColor(_gray, cv2.COLOR_GRAY2BGR)`
    }
    case 'equalize_histogram': {
      return `${hdr}
_ycrcb = cv2.cvtColor(out, cv2.COLOR_BGR2YCrCb)
_y, _cr, _cb = cv2.split(_ycrcb)
_y = cv2.equalizeHist(_y)
out = cv2.cvtColor(cv2.merge((_y, _cr, _cb)), cv2.COLOR_YCrCb2BGR)`
    }
    case 'clahe': {
      const clip = flt(p.clip_limit, 2)
      const gs = intg(p.tile_grid_size, 8)
      return `${hdr}
_lab = cv2.cvtColor(out, cv2.COLOR_BGR2LAB)
_l, _a, _b = cv2.split(_lab)
_clahe = cv2.createCLAHE(clipLimit=${pyVal(clip)}, tileGridSize=(${gs}, ${gs}))
_l = _clahe.apply(_l)
out = cv2.cvtColor(cv2.merge((_l, _a, _b)), cv2.COLOR_LAB2BGR)`
    }
    case 'gamma': {
      const g = flt(p.gamma, 1)
      return `${hdr}
_g = ${pyVal(g)}
_lut = (np.linspace(0, 1, 256) ** _g * 255).astype(np.uint8)
out = cv2.LUT(out, _lut)`
    }
    case 'invert':
      return `${hdr}
out = cv2.bitwise_not(out)`
    case 'log_transform': {
      return `${hdr}
_x = out.astype(np.float32)
out = np.clip(255.0 * np.log1p(_x) / np.log(256.0), 0, 255).astype(np.uint8)`
    }
    case 'inverse_log_transform': {
      return `${hdr}
_s = out.astype(np.float32)
out = np.clip(np.exp(_s / 255.0 * np.log(256.0)) - 1.0, 0, 255).astype(np.uint8)`
    }
    case 'threshold_binary': {
      const t = intg(p.thresh, 127)
      return `${hdr}
_t = ${pyVal(t)}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_, _bw = cv2.threshold(_gray, _t, 255, cv2.THRESH_BINARY)
out = cv2.cvtColor(_bw, cv2.COLOR_GRAY2BGR)`
    }
    case 'threshold_otsu': {
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_, _bw = cv2.threshold(_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
out = cv2.cvtColor(_bw, cv2.COLOR_GRAY2BGR)`
    }
    case 'adaptive_mean': {
      const bs = intg(p.block_size, 11) | 1
      const c = intg(p.C, 2)
      return `${hdr}
_bs, _c = ${bs}, ${c}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_bw = cv2.adaptiveThreshold(_gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, _bs, _c)
out = cv2.cvtColor(_bw, cv2.COLOR_GRAY2BGR)`
    }
    case 'adaptive_gaussian': {
      const bs = intg(p.block_size, 11) | 1
      const c = intg(p.C, 2)
      return `${hdr}
_bs, _c = ${bs}, ${c}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_bw = cv2.adaptiveThreshold(_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, _bs, _c)
out = cv2.cvtColor(_bw, cv2.COLOR_GRAY2BGR)`
    }
    case 'solarize': {
      const t = intg(p.threshold, 128)
      return `${hdr}
_t = ${pyVal(t)}
_lut = np.array([i if i < _t else 255 - i for i in range(256)], dtype=np.uint8)
out = cv2.LUT(out, _lut)`
    }
    case 'posterize': {
      const levels = intg(p.levels, 4)
      return `${hdr}
_lv = ${pyVal(levels)}
_step = 256 // _lv
out = ((out // _step) * _step).astype(np.uint8)`
    }
    case 'threshold_ext': {
      const t = intg(p.threshold, 127)
      const mode = String(p.mode ?? 'truncate').toLowerCase()
      const flag = mode === 'tozero' ? 'cv2.THRESH_TOZERO' : 'cv2.THRESH_TRUNC'
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_, _res = cv2.threshold(_gray, ${pyVal(t)}, 255, ${flag})
out = cv2.cvtColor(_res, cv2.COLOR_GRAY2BGR)`
    }
    case 'to_grayscale': {
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
out = cv2.cvtColor(_gray, cv2.COLOR_GRAY2BGR)`
    }
    case 'color_hsv_roundtrip':
      return `${hdr}
out = cv2.cvtColor(cv2.cvtColor(out, cv2.COLOR_BGR2HSV), cv2.COLOR_HSV2BGR)`
    case 'color_lab_roundtrip':
      return `${hdr}
out = cv2.cvtColor(cv2.cvtColor(out, cv2.COLOR_BGR2LAB), cv2.COLOR_LAB2BGR)`
    case 'color_ycrcb_roundtrip':
      return `${hdr}
out = cv2.cvtColor(cv2.cvtColor(out, cv2.COLOR_BGR2YCrCb), cv2.COLOR_YCrCb2BGR)`
    case 'channel_gains': {
      const b = flt(p.b, 1)
      const g = flt(p.g, 1)
      const r = flt(p.r, 1)
      return `${hdr}
_b, _g, _r = cv2.split(out)
_b = np.clip(_b.astype(np.float32) * ${pyVal(b)}, 0, 255).astype(np.uint8)
_g = np.clip(_g.astype(np.float32) * ${pyVal(g)}, 0, 255).astype(np.uint8)
_r = np.clip(_r.astype(np.float32) * ${pyVal(r)}, 0, 255).astype(np.uint8)
out = cv2.merge((_b, _g, _r))`
    }
    case 'extract_channel': {
      const ch = intg(p.channel, 0)
      return `${hdr}
_ch = ${pyVal(ch)}
_plane = out[:, :, _ch]
out = cv2.cvtColor(_plane, cv2.COLOR_GRAY2BGR)`
    }
    case 'brightness_contrast': {
      const alpha = flt(p.contrast, 1)
      const beta = intg(p.brightness, 0)
      return `${hdr}
out = cv2.convertScaleAbs(out, alpha=${pyVal(alpha)}, beta=${pyVal(beta)})`
    }
    case 'color_threshold': {
      return `${hdr}
_lower = np.array([${intg(p.min_blue, 0)}, ${intg(p.min_green, 0)}, ${intg(p.min_red, 0)}])
_upper = np.array([${intg(p.max_blue, 255)}, ${intg(p.max_green, 255)}, ${intg(p.max_red, 255)}])
_mask = cv2.inRange(out, _lower, _upper)
out = cv2.bitwise_and(out, out, mask=_mask)`
    }
    case 'gaussian_blur': {
      const k = intg(p.ksize, 5) | 1
      const sig = flt(p.sigma, 0)
      return `${hdr}
out = cv2.GaussianBlur(out, (${k}, ${k}), ${pyVal(sig)})`
    }
    case 'box_blur': {
      const k = intg(p.ksize, 5) | 1
      return `${hdr}
out = cv2.blur(out, (${k}, ${k}))`
    }
    case 'median_blur': {
      const k = intg(p.ksize, 5) | 1
      return `${hdr}
out = cv2.medianBlur(out, ${k})`
    }
    case 'bilateral_filter': {
      const d = intg(p.d, 9)
      const sc = flt(p.sigma_color, 75)
      const ss = flt(p.sigma_space, 75)
      return `${hdr}
out = cv2.bilateralFilter(out, ${d}, ${pyVal(sc)}, ${pyVal(ss)})`
    }
    case 'unsharp_mask': {
      const sig = flt(p.sigma, 1)
      const amt = flt(p.amount, 1)
      return `${hdr}
_sig, _amt = ${pyVal(sig)}, ${pyVal(amt)}
_blur = cv2.GaussianBlur(out, (0, 0), sigmaX=_sig)
out = cv2.addWeighted(out, 1.0 + _amt, _blur, -_amt, 0)`
    }
    case 'sobel_magnitude': {
      let k = intg(p.ksize, 3)
      if (k % 2 === 0) k += 1
      return `${hdr}
_k = ${k}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_gx = cv2.Sobel(_gray, cv2.CV_32F, 1, 0, ksize=_k)
_gy = cv2.Sobel(_gray, cv2.CV_32F, 0, 1, ksize=_k)
_mag = cv2.magnitude(_gx, _gy)
_mag = cv2.normalize(_mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_mag, cv2.COLOR_GRAY2BGR)`
    }
    case 'scharr_magnitude': {
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_gx = cv2.Scharr(_gray, cv2.CV_32F, 1, 0)
_gy = cv2.Scharr(_gray, cv2.CV_32F, 0, 1)
_mag = cv2.magnitude(_gx, _gy)
_mag = cv2.normalize(_mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_mag, cv2.COLOR_GRAY2BGR)`
    }
    case 'laplacian': {
      let k = intg(p.ksize, 3)
      if (k % 2 === 0) k += 1
      return `${hdr}
_k = ${k}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_lap = cv2.Laplacian(_gray, cv2.CV_32F, ksize=_k)
_mag = cv2.normalize(np.abs(_lap), None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_mag, cv2.COLOR_GRAY2BGR)`
    }
    case 'canny': {
      const t1 = intg(p.threshold1, 50)
      const t2 = intg(p.threshold2, 150)
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_edges = cv2.Canny(_gray, ${pyVal(t1)}, ${pyVal(t2)})
out = cv2.cvtColor(_edges, cv2.COLOR_GRAY2BGR)`
    }
    case 'prewitt': {
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_kx = np.array([[1, 1, 1], [0, 0, 0], [-1, -1, -1]], dtype=np.float32)
_ky = np.array([[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]], dtype=np.float32)
_px = cv2.filter2D(_gray, cv2.CV_32F, _kx)
_py = cv2.filter2D(_gray, cv2.CV_32F, _ky)
_mag = cv2.normalize(np.sqrt(_px * _px + _py * _py), None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_mag, cv2.COLOR_GRAY2BGR)`
    }
    case 'roberts': {
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_kx = np.array([[1, 0], [0, -1]], dtype=np.float32)
_ky = np.array([[0, 1], [-1, 0]], dtype=np.float32)
_rx = cv2.filter2D(_gray, cv2.CV_32F, _kx)
_ry = cv2.filter2D(_gray, cv2.CV_32F, _ky)
_mag = cv2.normalize(np.sqrt(_rx * _rx + _ry * _ry), None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_mag, cv2.COLOR_GRAY2BGR)`
    }
    case 'directional_gradient': {
      const axis = String(p.axis ?? 'x').toLowerCase()
      let k = intg(p.ksize, 3)
      if (k % 2 === 0) k += 1
      const dx = axis === 'y' ? 0 : 1
      const dy = axis === 'y' ? 1 : 0
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_g = cv2.Sobel(_gray, cv2.CV_32F, ${dx}, ${dy}, ksize=${k})
_mag = cv2.normalize(np.abs(_g), None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_mag, cv2.COLOR_GRAY2BGR)`
    }
    case 'log': {
      const sig = flt(p.sigma, 1.4)
      let lk = intg(p.laplacian_ksize, 3)
      if (lk % 2 === 0) lk += 1
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_blur = cv2.GaussianBlur(_gray, (0, 0), sigmaX=${pyVal(sig)}, sigmaY=${pyVal(sig)})
_lap = cv2.Laplacian(_blur, cv2.CV_32F, ksize=${lk})
_mag = cv2.normalize(np.abs(_lap), None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_mag, cv2.COLOR_GRAY2BGR)`
    }
    case 'dog': {
      const s1 = flt(p.sigma1, 1)
      const s2 = flt(p.sigma2, 2)
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).astype(np.float32)
_g1 = cv2.GaussianBlur(_gray, (0, 0), sigmaX=${pyVal(s1)}, sigmaY=${pyVal(s1)})
_g2 = cv2.GaussianBlur(_gray, (0, 0), sigmaX=${pyVal(s2)}, sigmaY=${pyVal(s2)})
_dog = np.abs(_g2 - _g1)
_dog = cv2.normalize(_dog, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_dog, cv2.COLOR_GRAY2BGR)`
    }
    case 'lbp': {
      return `${hdr}
# 8-neighbor LBP (same order as V-Rush backend)
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).astype(np.int16)
_pad = np.pad(_gray, 1, mode="edge")
_c = _pad[1:-1, 1:-1]
_bits = [
    _pad[0:-2, 0:-2] >= _c, _pad[0:-2, 1:-1] >= _c, _pad[0:-2, 2:] >= _c, _pad[1:-1, 2:] >= _c,
    _pad[2:, 2:] >= _c, _pad[2:, 1:-1] >= _c, _pad[2:, 0:-2] >= _c, _pad[1:-1, 0:-2] >= _c,
]
_lbp = np.zeros_like(_c, dtype=np.uint8)
for _i, _b in enumerate(_bits):
    _lbp |= _b.astype(np.uint8) << _i
out = cv2.cvtColor(_lbp, cv2.COLOR_GRAY2BGR)`
    }
    case 'glcm_contrast': {
      const patch = intg(p.patch_size, 15) | 1
      const levels = intg(p.levels, 16)
      return `${hdr}
# Local GLCM contrast (horizontal pairs), grid + resize — matches V-Rush approach
_patch_req, _levels = ${patch}, ${levels}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_h, _w = _gray.shape
_patch = max(3, min(_patch_req | 1, _h, _w))
if _patch % 2 == 0:
    _patch -= 1
_ny = min(128, max(1, _h - _patch + 1))
_nx = min(128, max(1, _w - _patch + 1))
_grid = np.zeros((_ny, _nx), dtype=np.float32)
for _gy in range(_ny):
    _y0 = 0 if _ny == 1 else int(round(_gy * (_h - _patch) / max(_ny - 1, 1)))
    _y0 = max(0, min(_h - _patch, _y0))
    for _gx in range(_nx):
        _x0 = 0 if _nx == 1 else int(round(_gx * (_w - _patch) / max(_nx - 1, 1)))
        _x0 = max(0, min(_w - _patch, _x0))
        _sl = _gray[_y0 : _y0 + _patch, _x0 : _x0 + _patch]
        _g = (_sl.astype(np.float32) / 255.0 * (_levels - 1)).astype(np.int32)
        _g = np.clip(_g, 0, _levels - 1)
        _a, _b = _g[:, :-1].ravel(), _g[:, 1:].ravel()
        _hist = np.bincount(_a * _levels + _b, minlength=_levels * _levels).reshape(_levels, _levels)
        _hist = _hist + _hist.T
        _s = float(_hist.sum()) + 1e-12
        _p = _hist / _s
        _ii, _jj = np.indices((_levels, _levels))
        _grid[_gy, _gx] = float(np.sum(_p * (_ii - _jj) ** 2))
_up = cv2.resize(_grid, (_w, _h), interpolation=cv2.INTER_LINEAR)
_up = cv2.normalize(_up, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_up, cv2.COLOR_GRAY2BGR)`
    }
    case 'gabor': {
      const k = intg(p.ksize, 21) | 1
      const sigma = flt(p.sigma, 4)
      const theta = flt(p.theta_deg, 0)
      const lambd = flt(p['lambda'], 10)
      const gamma = flt(p.gamma, 0.5)
      const psi = flt(p.psi_deg, 0)
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).astype(np.float32)
_kern = cv2.getGaborKernel(
    (${k}, ${k}), ${pyVal(sigma)}, np.deg2rad(${pyVal(theta)}), ${pyVal(lambd)}, ${pyVal(gamma)}, np.deg2rad(${pyVal(psi)}), ktype=cv2.CV_32F
)
_resp = cv2.filter2D(_gray, cv2.CV_32F, _kern)
_mag = cv2.normalize(np.abs(_resp), None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_mag, cv2.COLOR_GRAY2BGR)`
    }
    case 'morph_erode':
    case 'morph_dilate':
    case 'morph_open':
    case 'morph_close':
    case 'morph_gradient':
    case 'morph_tophat':
    case 'morph_blackhat': {
      const k = intg(p.ksize, 5) | 1
      const shape = String(p.kernel_shape ?? 'rect')
      const morphMap: Record<string, string> = {
        morph_erode: 'cv2.MORPH_ERODE',
        morph_dilate: 'cv2.MORPH_DILATE',
        morph_open: 'cv2.MORPH_OPEN',
        morph_close: 'cv2.MORPH_CLOSE',
        morph_gradient: 'cv2.MORPH_GRADIENT',
        morph_tophat: 'cv2.MORPH_TOPHAT',
        morph_blackhat: 'cv2.MORPH_BLACKHAT',
      }
      const m = morphMap[op] ?? 'cv2.MORPH_ERODE'
      return `${hdr}
_k = ${k}
_ks = ${JSON.stringify(shape)}
if _ks == "ellipse":
    _kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (_k, _k))
elif _ks == "cross":
    _kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (_k, _k))
else:
    _kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (_k, _k))
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_gray = cv2.morphologyEx(_gray, ${m}, _kernel)
out = cv2.cvtColor(_gray, cv2.COLOR_GRAY2BGR)`
    }
    case 'flip': {
      const mode = String(p.mode ?? 'horizontal').toLowerCase()
      const code = mode === 'vertical' ? '0' : mode === 'both' ? '-1' : '1'
      return `${hdr}
out = cv2.flip(out, ${code})`
    }
    case 'translate': {
      const tx = intg(p.tx, 0)
      const ty = intg(p.ty, 0)
      return `${hdr}
_h, _w = out.shape[:2]
_M = np.float32([[1, 0, ${pyVal(tx)}], [0, 1, ${pyVal(ty)}]])
out = cv2.warpAffine(out, _M, (_w, _h))`
    }
    case 'shear': {
      const sx = flt(p.shear_x, 0)
      const sy = flt(p.shear_y, 0)
      return `${hdr}
_h, _w = out.shape[:2]
_M = np.float32([[1, ${pyVal(sx)}, 0], [${pyVal(sy)}, 1, 0]])
out = cv2.warpAffine(out, _M, (_w, _h))`
    }
    case 'resize': {
      const mode = String(p.mode ?? 'scale')
      if (mode === 'absolute') {
        const w = intg(p.width, 320)
        const h = intg(p.height, 240)
        return `${hdr}
out = cv2.resize(out, (${w}, ${h}), interpolation=cv2.INTER_AREA)`
      }
      const scale = flt(p.scale, 0.5)
      return `${hdr}
_s = ${pyVal(scale)}
_h, _w = out.shape[:2]
out = cv2.resize(out, (int(_w * _s), int(_h * _s)), interpolation=cv2.INTER_AREA)`
    }
    case 'rotate': {
      const ang = flt(p.angle_deg, 15)
      const sc = flt(p.scale, 1)
      return `${hdr}
_h, _w = out.shape[:2]
_M = cv2.getRotationMatrix2D((_w / 2, _h / 2), ${pyVal(ang)}, ${pyVal(sc)})
out = cv2.warpAffine(out, _M, (_w, _h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)`
    }
    case 'pyramid_down':
      return `${hdr}
out = cv2.pyrDown(out)`
    case 'pyramid_up':
      return `${hdr}
out = cv2.pyrUp(out)`
    case 'crop_fraction': {
      const x0 = flt(p.x0, 0)
      const y0 = flt(p.y0, 0)
      const x1 = flt(p.x1, 1)
      const y1 = flt(p.y1, 1)
      return `${hdr}
_h, _w = out.shape[:2]
_xa, _xb = int(${pyVal(x0)} * _w), int(${pyVal(x1)} * _w)
_ya, _yb = int(${pyVal(y0)} * _h), int(${pyVal(y1)} * _h)
if _xb > _xa and _yb > _ya:
    out = out[_ya:_yb, _xa:_xb].copy()`
    }
    case 'add_gaussian_noise': {
      const sig = flt(p.sigma, 25)
      return `${hdr}
_sig = ${pyVal(sig)}
if _sig > 0:
    _noise = np.random.normal(0, _sig, out.shape).astype(np.float32)
    out = np.clip(out.astype(np.float32) + _noise, 0, 255).astype(np.uint8)`
    }
    case 'add_salt_pepper': {
      const ratio = flt(p.ratio, 0.05)
      return `${hdr}
_r = ${pyVal(ratio)}
if _r > 0:
    _rnd = np.random.random(out.shape[:2])
    _salt = _rnd < _r / 2
    _pepper = _rnd >= 1.0 - _r / 2
    out = out.copy()
    out[_salt] = 255
    out[_pepper] = 0`
    }
    case 'nl_means_gray': {
      const h = flt(p.h, 10)
      const tw = intg(p.template_window_size, 7) | 1
      const sw = intg(p.search_window_size, 21) | 1
      return `${hdr}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
_gray = cv2.fastNlMeansDenoising(_gray, None, ${pyVal(h)}, ${pyVal(tw)}, ${pyVal(sw)})
out = cv2.cvtColor(_gray, cv2.COLOR_GRAY2BGR)`
    }
    case 'nl_means_color': {
      const h = flt(p.h, 10)
      const hc = flt(p.h_color, 10)
      const tw = intg(p.template_window_size, 7) | 1
      const sw = intg(p.search_window_size, 21) | 1
      return `${hdr}
out = cv2.fastNlMeansDenoisingColored(out, None, ${pyVal(h)}, ${pyVal(hc)}, ${pyVal(tw)}, ${pyVal(sw)})`
    }
    case 'dft_magnitude_spectrum': {
      const sd = String(p.spectrum_display ?? 'jet').toLowerCase() === 'gray' ? 'gray' : 'jet'
      return `${hdr}
_sd = ${JSON.stringify(sd)}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).astype(np.float32)
_h, _w = _gray.shape
_ph, _pw = cv2.getOptimalDFTSize(_h), cv2.getOptimalDFTSize(_w)
_pad = cv2.copyMakeBorder(_gray, 0, _ph - _h, 0, _pw - _w, cv2.BORDER_CONSTANT)
_dft = cv2.dft(_pad, flags=cv2.DFT_COMPLEX_OUTPUT)
_shift = np.fft.fftshift(_dft)
_mag = cv2.magnitude(_shift[:, :, 0], _shift[:, :, 1])
_mag = np.log(_mag + 1e-6)
_mag = cv2.normalize(_mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_mag, cv2.COLOR_GRAY2BGR) if _sd == "gray" else cv2.applyColorMap(_mag, cv2.COLORMAP_JET)`
    }
    case 'dft_phase_spectrum': {
      const sd = String(p.spectrum_display ?? 'jet').toLowerCase() === 'gray' ? 'gray' : 'jet'
      return `${hdr}
_sd = ${JSON.stringify(sd)}
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).astype(np.float32)
_h, _w = _gray.shape
_ph, _pw = cv2.getOptimalDFTSize(_h), cv2.getOptimalDFTSize(_w)
_pad = cv2.copyMakeBorder(_gray, 0, _ph - _h, 0, _pw - _w, cv2.BORDER_CONSTANT)
_dft = cv2.dft(_pad, flags=cv2.DFT_COMPLEX_OUTPUT)
_shift = np.fft.fftshift(_dft)
_phase = np.arctan2(_shift[:, :, 1], _shift[:, :, 0])
_ph8 = cv2.normalize(_phase, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_ph8, cv2.COLOR_GRAY2BGR) if _sd == "gray" else cv2.applyColorMap(_ph8, cv2.COLORMAP_JET)`
    }
    case 'frequency_gaussian_lowpass': {
      const sig = flt(p.sigma_frequency, 30)
      return `${hdr}
_sigma_f = ${pyVal(sig)}
_max_sig = min(out.shape[0], out.shape[1]) / 2
_sigma_f = float(np.clip(_sigma_f, 1.0, _max_sig))
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).astype(np.float32)
_oh, _ow = _gray.shape
_pad = cv2.copyMakeBorder(_gray, 0, cv2.getOptimalDFTSize(_oh) - _oh, 0, cv2.getOptimalDFTSize(_ow) - _ow, cv2.BORDER_CONSTANT)
_h, _w = _pad.shape
_dft = cv2.dft(_pad, flags=cv2.DFT_COMPLEX_OUTPUT)
_shift = np.fft.fftshift(_dft)
_cy, _cx = _h // 2, _w // 2
_yy, _xx = np.ogrid[:_h, :_w]
_g = np.exp(-((_xx - _cx) ** 2 + (_yy - _cy) ** 2) / (2 * _sigma_f ** 2)).astype(np.float32)
_mask = _g
_shift[:, :, 0] *= _mask
_shift[:, :, 1] *= _mask
_un = np.fft.ifftshift(_shift)
_img = cv2.idft(_un)
_img = cv2.magnitude(_img[:, :, 0], _img[:, :, 1])
_img = cv2.normalize(_img[:_oh, :_ow], None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_img, cv2.COLOR_GRAY2BGR)`
    }
    case 'frequency_gaussian_highpass': {
      const sig = flt(p.sigma_frequency, 30)
      return `${hdr}
_sigma_f = ${pyVal(sig)}
_max_sig = min(out.shape[0], out.shape[1]) / 2
_sigma_f = float(np.clip(_sigma_f, 1.0, _max_sig))
_gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).astype(np.float32)
_oh, _ow = _gray.shape
_pad = cv2.copyMakeBorder(_gray, 0, cv2.getOptimalDFTSize(_oh) - _oh, 0, cv2.getOptimalDFTSize(_ow) - _ow, cv2.BORDER_CONSTANT)
_h, _w = _pad.shape
_dft = cv2.dft(_pad, flags=cv2.DFT_COMPLEX_OUTPUT)
_shift = np.fft.fftshift(_dft)
_cy, _cx = _h // 2, _w // 2
_yy, _xx = np.ogrid[:_h, :_w]
_g = np.exp(-((_xx - _cx) ** 2 + (_yy - _cy) ** 2) / (2 * _sigma_f ** 2)).astype(np.float32)
_mask = 1.0 - _g
_shift[:, :, 0] *= _mask
_shift[:, :, 1] *= _mask
_un = np.fft.ifftshift(_shift)
_img = cv2.idft(_un)
_img = cv2.magnitude(_img[:, :, 0], _img[:, :, 1])
_img = cv2.normalize(_img[:_oh, :_ow], None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
out = cv2.cvtColor(_img, cv2.COLOR_GRAY2BGR)`
    }
    case 'yolo26_detect': {
      const conf = flt(p.conf, 0.25)
      const maxDet = intg(p.max_det, 100)
      const draw = p.draw !== false
      const drawPy = draw ? 'True' : 'False'
      return `${hdr}
# --- YOLO26 (Ultralytics) — not runnable with OpenCV alone.
# Install: pip install ultralytics
# Weights: yolo26n.pt (downloaded automatically on first YOLO("yolo26n.pt") if missing).
# AGPL-3.0 applies to Ultralytics; confirm licensing for your use case.
#
# from ultralytics import YOLO
# _yolo = YOLO("yolo26n.pt")
# _kwargs = {"conf": ${pyVal(conf)}, "max_det": ${pyVal(maxDet)}, "verbose": False}
# _classes = ${pyVal(p.classes ?? [])}
# if _classes:
#     _kwargs["classes"] = _classes
# _r = _yolo(out, **_kwargs)[0]
# out = _r.plot() if ${drawPy} else out
# # Detections: iterate _r.boxes for label, conf, xyxy when draw is False
raise NotImplementedError("Uncomment the block above and add ultralytics + yolo26n.pt to run YOLO26 offline.")`
    }
    default:
      return `${hdr}
# Unsupported or unknown op id in exporter: ${JSON.stringify(op)}
# Params were: ${pyDict(p)}
raise NotImplementedError(${JSON.stringify(op)})`
  }
}

export interface PipelineStepExport {
  op: string
  params: Record<string, unknown>
}

/** Build a standalone script: assign `img` (BGR) then run; result in `out`. */
export function pipelineToPython(steps: PipelineStepExport[]): string {
  const header = `# Generated by V-Rush — OpenCV + NumPy pipeline
# Requires: pip install opencv-python numpy
import cv2
import numpy as np

# Load your image (BGR)
# img = cv2.imread("input.png")
# if img is None:
#     raise SystemExit("Could not read image")

`

  const body =
    steps.length === 0
      ? 'out = img.copy()'
      : ['out = img.copy()', ...steps.map((s, i) => emitStep(s.op, s.params, i + 1))].join('\n\n')

  const footer = `

# Save result
# cv2.imwrite("output.png", out)
`

  return header + body + footer
}
