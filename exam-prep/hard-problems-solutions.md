# Three Hard Problems — Solutions

## Problem 1 — Standing on tiptoe
mg = 70 × 9.81 = 686.7 N.

**(a)** Fulcrum = ball of foot, load = body weight at the ankle (12 cm), effort = Achilles tendon at the heel (17 cm).
The **load is in the middle**, so it is a **class 2** lever.
MA = d_effort / d_load = 17/12 = **1.42**. DA = 1/MA = **0.71**. You gain force and lose speed.

**(b)** Moments about the ball of the foot: $T \times 17 = 686.7 \times 12$, so **T = 485 N**.

**(c)** Tendon force = fibre tension × cos α, so fibre tension = 485 / cos 20° = **516 N**.
PCSA = 516 / 90 N/cm² = **5.7 cm²**.

**(d)** Area $A = V/L_f$:
- P (pennate): A = 60/4 = 15 cm², so fibre force = 90 × 15 = 1350 N and tendon force = 1350 cos 20° = **1269 N**.
- Q (parallel): A = 60/16 = 3.75 cm², so tendon force = 90 × 3.75 = **338 N**.

P is about **3.8×** stronger. Only **P** can hold the person (1269 N > 485 N, a 2.6× margin); Q fails (338 N < 485 N).
That is why the calf is pennate: short fibres pack more area into the same volume, and the cos 20° loss is small.

**(e)** Body speed = DA × muscle speed = 0.706 × 2 = **1.41 cm/s**.
Power in = 485 × 0.020 = 9.7 W. Power out = 686.7 × 0.0141 = 9.7 W. They are equal, so power is conserved ✓.

---

## Problem 2 — McKibben elbow
P = 400 kPa = **400 000 Pa** (convert first!), b = 0.40 m, n = 3.

**(a)** $L_0 = b\cos\theta = 0.4\cos25° = \textbf{0.363 m}$. $D_0 = \dfrac{b\sin\theta}{n\pi} = \dfrac{0.4 \times 0.423}{3\pi} = \textbf{17.9 mm}$.

**(b)** $F = \dfrac{Pb^2}{4\pi n^2}(3\cos^2\theta - 1)$.
$\dfrac{b^2}{4\pi n^2} = \dfrac{0.16}{4\pi \times 9} = 1.415\times10^{-3}$ m², and $3\cos^2 25° - 1 = 1.464$.
F = 400 000 × 1.415×10⁻³ × 1.464 = **829 N**.

**(c)** It contracts until θ = 54.7°: $L_{\min} = 0.4\cos54.7° = 0.231$ m.
Stroke = 0.363 − 0.231 = **13.2 cm**, which is **36 %** of L₀.

**(d)** Class 3 lever: $829 \times 0.05 = mg \times 0.30$, so mg = 138 N and **m = 14.1 kg**.

**(e)** At 45°: 3cos²45° − 1 = 0.5, so F = 400 000 × 1.415×10⁻³ × 0.5 = **283 N** → mg = 283 × 0.05/0.30 = 47.2 N → **m = 4.8 kg**.
To hold 14.1 kg (138 N load, so the muscle must pull 829 N) at 45°: P = 829 / (1.415×10⁻³ × 0.5) = **1.17 MPa**.
Why the force drops: as θ approaches 54.7° the volume approaches its maximum, so each bit of shortening gains less volume and
$F = -P\,dV/dL$ falls to zero at 54.7°. It is like a muscle's force-length curve: least force when fully shortened.

---

## Problem 3 — Basketball player
mg = 75 × 9.81 = 735.8 N.

**(a)** $a = \dfrac{N - mg}{m} = \dfrac{1900 - 735.8}{75} = \textbf{15.5 m/s²}$ (divide by **m**, not mg!).
$v_{TO} = \sqrt{2as} = \sqrt{2 \times 15.52 \times 0.45} = \textbf{3.74 m/s}$.
$\tau = v_{TO}/a = \textbf{0.24 s}$.
$H = \dfrac{v_{TO}^2}{2g} = \textbf{0.71 m}$. Check: $H = (N-mg)s/(mg) = 1164 \times 0.45/735.8 = 0.71$ m ✓.

**(b)** From $H = (N - mg)s/(mg)$: $N = mg\left(1 + \dfrac{H}{s}\right) = 735.8 \times (1 + 0.80/0.45) = \textbf{2044 N ≈ 2.8 body weights}$.

**(c)** $s = \dfrac{H\,mg}{N - mg} = \dfrac{0.80 \times 735.8}{1164} = \textbf{0.51 m}$.

**(d)** $m_b - m_\ell = 66$ kg, $m_b - 2m_\ell = 57$ kg, 2FL = 2 × 450 × 1.1 = 990 J.
- $v_1 = \sqrt{990/66} = \textbf{3.87 m/s}$
- $v_\text{final} = \sqrt{2FL/m_\ell} = \sqrt{990/9} = \textbf{10.5 m/s}$
- $r = 57/66 = 0.864$. Reaching 90 % speed means $v^2 = 0.81\,v_f^2$, so $1 - r^n = 0.81$, $r^n = 0.19$, $n = \ln0.19/\ln0.864 = 11.3$ → **12 strides** (about 13 m).

**(e)** Countermovement: the eccentric pre-stretch stores elastic energy in the tendons (SEC), raises muscle activation, and starts
the push already at high force (stretch-shortening cycle). So more work is done over the same s, and he jumps higher.
Top speed: at constant speed the upper body no longer speeds up, so every stride's work FL goes into re-accelerating one leg from
rest: $FL = \tfrac12 m_\ell v^2$. That is why only the leg mass sets the top speed, and why light distal legs (ostriches, horses) help.
