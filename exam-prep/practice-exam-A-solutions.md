# Practice Midterm A — Solutions

### Q1 (10)
(a) Advantages (any 3): inherent **compliance**, so contact with humans is safe; **adaptability**: conformal or whole-arm grasping of unknown, delicate
objects without a custom end effector; high-curvature bending and twisting, so it can move through cluttered or unstructured spaces; resilience on rough terrain;
light, cheap, and impact-tolerant.
Challenges (any 2): **control**, because continuous deformation under gravity or contact can't be fully observed with a few sensors or controlled with a few actuators;
modelling (nonlinear, hyperelastic, hysteresis); lower force and precision; integrating sensors, actuators and computation; pneumatic tethers and compressors;
the actuator's stress limit set by the rubber's fracture strength.
(b) Rigid arms are stiff, heavy and **overpowered**, with no compliance to absorb a collision. An unexpected contact with a person transmits large forces, so the
workspace is separated from humans for safety.
(c) Motors are made of copper and iron, about **7–9× denser than muscle**. Much of the actuator's mass must be carried and accelerated, so
payload/self-weight is low. Slide data: human biceps 10 kg load / 3.7 kg = **2.7**; KINOVA Gen2 2.6/4.4 = **0.59**; UR10e 12.5/33.5 = **0.37**.
Since a ≈ F/m, the heavy arm also accelerates poorly (it can't throw, as with TossingBot). Muscle also benefits from tendon elasticity (SSC).

### Q2 (10)
(a) $T = F\sin\alpha\,d = 500\sin70°\times0.04 = 469.8\times0.04 = \mathbf{18.8\ N\cdot m}$
(b) $F_\parallel = 500\cos70° = \mathbf{171\ N}$. Its line of action passes through the joint centre (zero moment arm), so there is **no torque**. With the
elbow flexed below 90°, it pulls the radius **away** from the joint: a **dislocating** component. (Above 90° it presses the bones together and stabilizes.)
(c) $F_{\max} = 90\ \text{N/cm}^2\times6\ \text{cm}^2 = \mathbf{540\ N}$

### Q3 (10)
(a) $A = V/L_f$: $A_P = V_0/12$, $A_Q = V_0/3$. Tendon force ∝ effective area $A\cos\alpha$:
$$\frac{F_Q}{F_P} = \frac{(V_0/3)\cos25°}{(V_0/12)\cos0°} = 4\times0.906 = \mathbf{3.63}$$
(b) **P** (long parallel fibres): more sarcomeres in series, so a larger absolute shortening and higher shortening speed, plus good position control.
**Q** is cheaper per unit force: for the same force, long fibres need more cross-bridges in series cycling, so ATP per force is higher in P.
(c) Parallel, long-fibred muscles sit **proximally** (thigh, e.g. hamstrings or sartorius), giving range and speed. Pennate, short-fibred muscles with long tendons sit
**distally** (calf, e.g. gastrocnemius or soleus), giving force and elastic energy storage in the tendon. This also keeps the distal limb light (low inertia).

### Q4 (10)
(a) The **A band** (myosin length) **stays the same**. The **I band** and **H zone** **shrink**. The filaments don't shorten; actin slides over myosin toward the
M line, pulling the Z lines together (sliding filament theory).
(b) ATP binding **detaches** the myosin head from actin, and its hydrolysis re-cocks the head for the next power stroke. Without ATP the heads stay
attached (rigor).
(c) Force ∝ the number of cross-bridges that can form. Very short: the myosin filaments collide with the Z discs and the actin filaments overlap each other, so the sarcomere cannot shorten
further and little tension forms. Very stretched: actin and myosin barely overlap, so few or no cross-bridges form. The optimum is at about 70–130 % of rest length.
(d) **Wave summation**: raising the firing *frequency* of a motor unit, so twitches add, up to fused tetanus. **Recruitment**: activating *more motor units*.
Asynchronous firing of units gives smooth force and delays fatigue.

### Q5 (12)
(a) Longitudinal: end force $p\pi r^2$ is carried by the wall area $2\pi r t$:
$$\sigma_L = \frac{p\pi r^2}{2\pi rt} = \frac{pr}{2t} = \frac{1000\times3}{2\times0.3} = \mathbf{5\ kPa}$$
Circumferential: cut lengthwise over length L. The force $p(2r)L$ is carried by two walls of area $tL$:
$$\sigma_C = \frac{2prL}{2tL} = \frac{pr}{t} = \mathbf{10\ kPa} = 2\sigma_L$$
(b) Constant volume: $L_2/L_1 = (D_1/D_2)^2 = (1/0.85)^2 = 1.384$, so **+38.4 %**. The linear formula gives $-2(-0.15) = +30\ \%$. The linear
result is only valid for *small* changes; the exact relation is nonlinear (∝ 1/D²), so the elongation grows faster than linearly for a large ΔD.
(c) The muscle tissue is **incompressible**, so the volume is constant (an isovolumetric muscular hydrostat), with no fluid exchange and a uniform cylindrical shape.

### Q6 (12)
(a) $D = \frac{b\sin\theta}{n\pi}$, so $V = \frac\pi4D^2L = \frac{b^3}{4\pi n^2}\sin^2\theta\cos\theta$.
$\frac{dV}{d\theta} = \frac{b^3}{4\pi n^2}(2\sin\theta\cos^2\theta - \sin^3\theta)$, $\frac{dL}{d\theta} = -b\sin\theta$.
Virtual work: pressure input equals mechanical output, $P\,dV = -F\,dL$:
$$F = -P\frac{dV/d\theta}{dL/d\theta} = \frac{Pb^2}{4\pi n^2}(2\cos^2\theta-\sin^2\theta) = \frac{Pb^2}{4\pi n^2}(3\cos^2\theta-1)$$
(b) $F = 0 \Rightarrow \cos^2\theta = 1/3 \Rightarrow \theta^* = \mathbf{54.7°}$. This is also where V is maximum.
(c) $L = 0.3\cos30° = \mathbf{0.260\ m}$; $D = 0.3\sin30°/(2\pi) = \mathbf{23.9\ mm}$;
$F = \frac{3\times10^5\times0.09}{4\pi\times4}(3\times0.75-1) = 537.1\times1.25 = \mathbf{671\ N}$ (tension).
(d) The muscle shortens until θ = 54.7°: $L_{\min} = 0.3\cos54.7° = 0.173$ m. Contraction = (0.260 − 0.173)/0.260 = **33 %**.

### Q7 (10)
(a) **Class 3** (the effort is between the fulcrum and the load). MA = 4/35 = **0.114**; DA = 35/4 = **8.75**.
(b) $F_b\times0.04 = 5\times9.81\times0.35 \Rightarrow F_b = \mathbf{429\ N}$ (8.75× the load).
(c) $v_\text{hand} = 8.75\times0.10 = \mathbf{0.875\ m/s}$. **Work and power conservation** in a lossless lever: $F_\text{in}v_\text{in} = F_\text{out}v_\text{out}$, so
MA × DA = 1. You gain speed at the cost of force.

### Q8 (12)
(a) The hip (mass m) moves on an arc of radius L over the stance foot. Radial equation at the top: $mg - R = mv^2/L$. The foot stays on the ground only if
$R \ge 0$, so $mv^2/L \le mg$ and $v_{\max} = \sqrt{gL}$.
(b) Earth: $\sqrt{9.81\times0.8} = \mathbf{2.80\ m/s}$. Mars: $\sqrt{3.71\times0.8} = \mathbf{1.72\ m/s}$. Moon: $\sqrt{1.62\times0.8} = \mathbf{1.14\ m/s}$.
That is why astronauts hop.
(c) They flatten the path of the centre of mass (hip drop, pelvic rotation, keeping the CG at nearly constant height), so the effective radius of curvature is
**greater than L** and the required centripetal acceleration v²/R_eff stays below g.
(d) Walking: duty factor **> 0.5** (each foot is on the ground more than half the time, with double support). Running: **< 0.5** (with a flight phase).
Tortoise: 3 of 4 legs down, so **DF = 0.75**.

### Q9 (8)
(a) $H = \frac{(N-mg)s}{mg} = \frac{(1600-686.7)\times0.40}{686.7} = \mathbf{0.53\ m}$; $v_{TO} = \sqrt{2gH} = \mathbf{3.23\ m/s}$.
(b) $a = (N-mg)/m = 913.3/70 = 13.05\ \text{m/s}^2$; $\tau = \sqrt{2s/a} = \sqrt{0.8/13.05} = \mathbf{0.25\ s}$ (check: $a\tau = 3.23$ m/s ✓).
(c) The **stretch-shortening cycle**. The countermovement pre-stretches the muscles and tendons (eccentric phase), storing elastic energy in the SEC.
It also raises muscle activation and recruitment before the concentric push, and starts the push already at high force. So more work is done over the same extension s.

### Q10 (6)
(a) $\rho_t(1-\phi) = 1026 \Rightarrow \phi = 1 - 1026/1080 = \mathbf{5.0\ \%}$ of the body volume.
(b) Tuna: $Re = 1026\times3\times1/10^{-3} ≈ \mathbf{3\times10^6}$, inertial, so **pressure (form) drag** dominates (it streamlines to delay separation).
Bacterium: $Re = 1000\times10^{-5}\times2\times10^{-6}/10^{-3} = \mathbf{2\times10^{-5}}$, viscous, so **skin-friction drag** dominates (it stops instantly when it stops swimming).
(c) $\eta = \frac{V+U}{2V} = \frac{1.25+1}{2\times1.25} = \mathbf{0.90}$
