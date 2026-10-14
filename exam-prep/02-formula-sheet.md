# Formula Sheet — weeks 1–7

Every equation from the slides, with the key numbers. Learn the **derivations** marked ★. The slides derive them step by step,
so they are classic exam material.

## Constants and reference values
| Quantity | Value |
|---|---|
| g (Earth / Moon / Mars) | 9.81 / 1.6 / 3.71 m/s² |
| Muscle max stress | ≈ 90 N/cm² of PCSA (70 running, 100 isometric in the quadriceps) |
| Muscle efficiency | ≈ 25 % |
| Max muscle power | at ≈ ⅓ v_max (and ≈ ⅓ F_max) |
| Sarcomere length / optimal range | 2–3 µm / 70–130 % of rest length |
| McKibben "magic angle" | θ* = arccos(1/√3) = **54.7°** |
| Fresh / sea water density | 1000 / 1026 kg/m³ |
| Water viscosity | 1.0×10⁻³ Pa·s (air 1.8×10⁻⁵) |
| Walk→run (energy crossover) | ≈ 2.3 m/s; mechanical limit √(gL) ≈ 3 m/s |
| Synthetic wheel | ω_F τ = 4.058, duty factor ≈ 0.65 ≈ ⅔ |

## Week 1 — Robots
| | |
|---|---|
| Harmonic drive ratio | $\dfrac{N_\text{flex}-N_\text{circ}}{N_\text{flex}}$ (negative means reversed) |
| Motor arm (Newton) | $T = (J_a+J_b)\dfrac{d\omega}{dt}$ |
| Work on arm and ball | $\int(T-T_b)d\theta = \tfrac12J_a\omega^2+\tfrac12m_bv^2$; on ball: $\int T_b d\theta = \tfrac12 m_bv^2 = m_bgh$ |

## Week 2 — Muscles
| | |
|---|---|
| Joint torque | $T_m = F_m\sin\alpha\; d_\perp$ |
| Rotary / parallel components | $F_m\sin\alpha$ (torque) / $F_m\cos\alpha$ (stabilizing or dislocating) |
| Max force | $F_\max = 90\,\text{N/cm}^2\times \text{PCSA}$ |
| Pennate tendon force | $F_t = F_f\cos\alpha$ |
| Area for a given volume | $A_m = V/L_f$; effective $A^*_m = A_m\cos\alpha$ |
| Muscle power | $P = F\,v$ |

## Week 3 — Skeleton and springs
| | |
|---|---|
| Newton, work, power | $F=ma$, $W=Fd$, $P=dW/dt = Fv$ |
| Stress, strain, modulus | $\sigma = F/A$, $\varepsilon = \Delta L/L_0$, $E = \sigma/\varepsilon$ |
| ★ Thin-walled cylinder | $\sigma_L = \dfrac{pr}{2t}$ (from $p\pi r^2 = \sigma_L 2\pi r t$); $\sigma_C = \dfrac{pr}{t}$ (from $p\,2rL = \sigma_C\,2tL$) |
| ★ Hydraulic leverage | $V=\pi r^2L$ constant, so $\dfrac{dL}{L} = -2\dfrac{dr}{r}$; exactly $\dfrac{L_2}{L_1} = \left(\dfrac{D_1}{D_2}\right)^2$ |
| ★ McKibben geometry | $L=b\cos\theta$, $n\pi D = b\sin\theta$, $V = \dfrac{b^3}{4\pi n^2}\sin^2\theta\cos\theta$ |
| ★ McKibben force | $F = -P\dfrac{dV}{dL} = \dfrac{Pb^2}{4\pi n^2}(3\cos^2\theta-1)$; $F=0$ at $\theta=54.7°$ |
| Max-volume condition | $dV/d\theta = 0 \Rightarrow 3\cos^2\theta = 1$ |
| Lever: MA and DA | $MA = F_\text{out}/F_\text{in}$, $DA = u_\text{out}/u_\text{in}$, and $MA\cdot DA = 1$ (no losses) |
| Work / power conservation | $F_ou_o = F_iu_i$, $F_ov_o = F_iv_i$ |
| Moment balance | $\sum M_O = 0$; Hooke's law: $F = k(\ell-\ell_0)$ |

## Week 4 — Walking
| | |
|---|---|
| Average limb force | $\bar F = I/\tau = W/n$, where $I = \int F\,dt$ |
| Rolling wheel | $x = r\theta$, $v = R\omega$ |
| ★ Max walking speed | $mg - R = mv^2/L$, $R\ge0 \Rightarrow v_\max = \sqrt{gL}$ |
| Pendulum energy | $\Delta PE = mgL(1-\cos\theta) = \Delta KE$ |
| Duty factor | stance time / stride period (walk > 0.5, run < 0.5) |
| ★ Synthetic wheel stance | $\theta_C = -\alpha+\Omega t$, $\tau = 2\alpha/\Omega$, $V = 2L\alpha/\tau = L\Omega$ |
| ★ Synthetic wheel swing | $\theta_F = \alpha\cos\omega_Ft + \dfrac{\Omega}{\omega_F}\sin\omega_Ft$; at $t=\tau$: $-1 = \cos x + \dfrac2x\sin x$, so $x = \omega_F\tau = 4.058$ |
| Simple pendulum (point mass) | $f = \dfrac1{2\pi}\sqrt{g/L}$ |
| Compound pendulum (uniform leg) | $f = \dfrac1{2\pi}\sqrt{\dfrac{3g}{2L}}$, so $T = 2\pi\sqrt{\dfrac{2L}{3g}}$ |
| EMA | $r/R$ (muscle moment arm / ground-force moment arm) |

## Week 5 — Running and jumping
| | |
|---|---|
| Sprott: stance normal force | $N = m(g - v^2/L)$ (≥ 0) |
| Impulse, vertical speed | $I = (mg-N)\tfrac T2 = m\Delta v_y$, $v_y(0) = (g - N/m)\tfrac T4$ |
| Height rise | $\Delta h = v_y(0)T/8$ |
| Power | $P = \dfrac{2mg\Delta h}{T} = \dfrac{mg\,v_y(0)}{4}$ |
| Walking power (Sprott) | $P_W = \dfrac{mg}{4}\dfrac{v^2}{L}\dfrac{T}{4}$ |
| Walking power (boxed lecture form) | $P_W = mgL\dfrac\pi2\sqrt{\dfrac{3L}{2g}}\left(\dfrac{\bar v}{L}\right)^2$ |
| Walking power (exact Sprott) | $P_W = \dfrac{mg}{\pi}\sqrt{\tfrac32gL}\left[1-\sqrt{1-\dfrac{\pi^2v^2}{6gL}}\right]$ |
| Running power | $P_R = mg\,v_y(0)/4$, with $v_y(0) ≈ 1.283\,v_x$ (or ≈ $v_x$ for best range) |
| ★ Sprint, stride 1 | $FL = \tfrac12(m_b-m_\text{leg})v_1^2$ |
| ★ Sprint, stride n | $FL = \tfrac12(m_b-2m_\text{leg})(v_n^2-v_{n-1}^2) + \tfrac12m_\text{leg}v_n^2$ |
| Sprint, closed form | $v_n^2 = \dfrac{2FL}{m_b-m_\text{leg}}\dfrac{1-r^n}{1-r}$, $r = \dfrac{m_b-2m_\text{leg}}{m_b-m_\text{leg}}$ |
| ★ Sprint top speed | $v_\text{final} = \sqrt{2FL/m_\text{leg}}$ |
| Propulsive force | $F = GRF\cos\theta$ (horizontal component) |
| ★ Jump height | $\int_0^s(N-mg)dz = \tfrac12mv_{TO}^2 = mgH \Rightarrow H = \dfrac{(N-mg)s}{mg}$ |
| ★ Take-off time | $a = \dfrac{N-mg}{m}$, $v_{TO} = a\tau$, $s = \tfrac12a\tau^2$, so $\tau = \sqrt{2s/a}$ |

## Week 6 — Water I
| | |
|---|---|
| Buoyancy | $F_B = \rho_\text{fluid}V_\text{sub}g$; floats if $\bar\rho \le \rho_\text{fluid}$ |
| Mixture density | $\bar\rho = \sum\rho_i V_i/V$ (submarine: $\rho_a V_a + \rho_w V_b + \rho_s V_s$ over V) |
| Viscous drag (shallow) | $R = \mu A v/h = cv$ |
| Skin friction | $D_f = \tfrac12\rho U^2 S C_f$, laminar $C_f = 0.664/\sqrt{Re_x}$ |
| Drag (form) | $D = \tfrac12\rho U^2 A C_D$ |
| Reynolds number | $Re = \dfrac{\rho U L}{\mu}$ (inertial / viscous) |
| Swimmer dynamics | $m\,du/dt = F_\text{prop} - F_\text{drag}$ |
| Propulsive drag | $F = \tfrac12\rho u^2AC_D$ or $F ≈ \rho V u/T$ |
| ★ Paddle-wheel arm | $V = \tfrac12L^2\theta w$, $u_w = \dfrac{L\theta}{2T}$, $F ≈ \dfrac{\rho\theta^2L^3w}{4T^2}$ |
| Rowing momentum | $m_bv_b = m_wv_w$; $KE = \tfrac12m_bv_b^2+\tfrac12m_wv_w^2$ |
| Oar lever | $L = E\,b/a$; $W = La\psi = Eb\psi$ |
| Control-volume thrust | $T = \dot m(v_\text{out}-v_\text{in})$, $\dot m = \rho A v$ |

## Week 7 — Water II
| | |
|---|---|
| Thrust from a pushed water mass | $T = mv/t$ |
| ★ Fish momentum | $MU = -m_wu_w$ |
| ★ Swimming energy | $W = \tfrac12MU^2\left(1+\dfrac{M}{m_w}\right)$ |
| Body wave (Lighthill) | $y = (c_1x+c_2x^2)\sin(kx+\omega t)$, $k = 2\pi/\lambda$, $\omega = 2\pi/T$ |
| Wave speed | $V = \lambda_b/T_b$ |
| Trailing-edge water mass | $m = \rho\pi d_T^2/4$ per unit length |
| ★ Water lateral speed | $w = W\dfrac{V-U}{V}$ (similar triangles) |
| Thrust / power | $T = m(wW - \tfrac12w^2)$, $P = mUwW$, $P_K = \tfrac12mw^2U$ |
| ★ Froude efficiency (fish) | $\eta = 1-\dfrac{w}{2W} = \dfrac{V+U}{2V}$ |
| Jet thrust | $T = \dfrac mt(U_2-U_1)$, $P_\text{out} = TU_1$, $P_\text{in} = \tfrac12\dfrac mt(U_2^2-U_1^2)$ |
| ★ Froude efficiency (jet) | $\eta = \dfrac{2U_1}{U_1+U_2}$ |
