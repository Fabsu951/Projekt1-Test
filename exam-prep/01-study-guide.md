# Study Guide — Bioinspired Soft Robotics (仿生軟機器人學), weeks 1–5

Course: 536116, Prof. LAU Gih-Keong, NYCU. This guide summarises the lecture slides week by week.
Each week ends with **"Likely exam angles"**: the things the slides emphasise (worked exercises,
derivations, comparison tables) and the material the homework already tested.

> Exam weighting from the course intro: Homework 20 %, **Midterm 30 %**, Experiment report and attendance 20 %, Final 30 %.
> **Exam scope (confirmed by the course email):** Week 1 Introduction to bioinspired soft robotics · Week 2 Muscles ·
> Week 3 Skeleton and springs · Week 4 Walking · Week 5 Running and jumping. Swimming, fish, flight and hovering are **not** on this exam.

---

## Week 1 — Introduction to bioinspired soft robotics

### Why soft robots?
- **Rigid robots**: rigid links and joints, precise position control through rigid transmission, high load capacity,
  consistent properties under large forces.
  **But**: they are not universal (each task needs a redesign or a custom end effector), struggle in unstructured or
  cluttered environments, make force control hard, and are *overpowered*, which makes them unsafe near humans.
  That is why factory robots are fenced off from people.
- **Soft robots** are made of rubber or other compliant materials and have a continuously deformable body with muscle-like actuation. They offer:
  - flexible, adaptable **compliance**; smooth and complex motion; **safe human interaction**
  - bending and twisting with high curvature; **whole-arm manipulation** (they wrap around objects)
  - adaptability to the environment, resilience on rough terrain
  - inspiration from **muscular hydrostats**: elephant trunk, octopus arm, tongue, squid tentacle.
- **Challenge**: control. Gravity and contact loads cause continuous deformation that the limited sensors may not observe
  and the limited actuators may not control. Integrating sensors, actuators and computation is the main open problem.
- **Load-sensitive arm**: an actuator tip moment bends a soft arm upward in a **quadratic** shape, while self-weight
  bends it downward in a **cubic** shape. Combined, the tip can be at zero displacement but the shape is not straight.

### Muscles vs motors (the "TossingBot" / payload argument)
- Motors are made of copper and iron, whose density is **7–9× that of muscle**. That gives a poor payload-to-self-weight
  ratio. Slide data (self-weight → max load → ratio): human biceps 3.7 kg → 10 kg → **2.7**; KINOVA Gen2 arm 4.4 → 2.6 → **0.59**;
  UR10e 33.5 → 12.5 → **0.37**. Since a ≈ F/m, a heavy arm also accelerates poorly.
- A motor drive is not ballistic: F = ma, and the work done on the arm goes into the arm's own inertia
  ($\int (T-T_b)\,d\theta = \tfrac12 J_a\omega^2 + \tfrac12 m_b v^2$).
- Animals use the **stretch-shortening cycle** (countermovement): stretch muscle and tendon first, then shorten. The tendon
  recoil adds work, so the motion is more explosive.

### Hydrostat-like drives vs "solid" muscles
| Pneumatic / hydraulic (≈ hydrostat) | Electroactive polymer (≈ muscle + tendon) |
|---|---|
| Rubbery cells with a fluid cavity | Solid material, sometimes with a liquid component |
| Max pressure limited by the **rubber's fracture strength** | Max actuation stress limited by the **polymer's strength** |
| Needs compressor, reservoir, valves | Needs only a circuit and the actuator |

Types of artificial muscle: pneumatic, hydraulic, shape memory alloy/polymer, dielectric elastomer, IPMC.

### Five applications of soft robotics (useful for HW1-type questions)
1. Robotic muscles: light but forceful
2. Climbing robots (caterpillar-like) for inspection, search and rescue
3. Edible or biodegradable robots for drug delivery
4. Wearable robots for rehabilitation
5. Prosthetics: soft grippers grasp delicate objects

### Industrial robots
- Definition (Robot Institute of America): *"a programmable, multifunction manipulator designed to move material, parts,
  tools, or special devices through variable programmed motions for the performance of a variety of tasks."*
- Parts: **controller**, **arm** (shoulder, elbow, wrist; each joint adds one DOF), **end effector** (gripper, suction,
  magnet, welding torch), **drive**, **sensors** (tactile, proximity/range, ambient, vision).
- Drives:
  - **Hydraulic**: large robots, high speed and strength, oil leakage, needs floor space.
  - **Electric**: less speed and strength, DC/AC servo or stepper motors. A stepper motor allows open-loop positioning.
  - **Pneumatic**: small robots, fast pick-and-place, cheap and simple, but **drifts under load** because air is compressible.
- **Harmonic drive** (strain-wave gear): wave generator (elliptical plug + bearing), flexspline, circular spline. Ratios of
  30:1–320:1 in the volume where a planetary gear gives about 10:1. No backlash, compact, coaxial input and output.
  The flexspline has fewer teeth, usually 2 fewer.
  $$\text{reduction ratio} = \frac{N_\text{flex}-N_\text{circ}}{N_\text{flex}}\quad\text{e.g. }\frac{200-202}{200}=-0.01\;(100{:}1,\text{ reversed})$$
- **Lead screw**: a short lead gives precise positioning and is non-back-drivable (non-overhauling). A long lead gives more travel per turn.
- **Diaphragm micro-pump**: a crank turns motor rotation into reciprocating motion. Stage 1: intake until bottom dead centre. Stage 2: discharge through the outlet valve.

### History (know a couple of examples)
Archytas' steam pigeon (350 BCE), da Vinci's mechanical lion (1500s), Honda ASIMO, Boston Dynamics Atlas
(hydraulic, about 2 m and 200 kg in 2013 → about 1.5 m, 80 kg, 28 DOF, power-autonomous). Hirose's soft gripper (1977): multiple
links and pulleys actuated by pairs of wires. Basic construction of a soft arm: a **backbone** (segmented or continuous) gives
bending stiffness, and **antagonistic cables** (or fluid-filled tubes) actuate it.

**Likely exam angles:** advantages and disadvantages of rigid vs soft robots (table); one application where soft beats
hard; drive types compared; harmonic drive ratio calculation; why motor-driven arms have a poor payload-to-weight ratio.

---

## Week 2 — Muscles: the driver of motion

### Types of muscle
1. **Cardiac**: striated, involuntary (heart wall)
2. **Smooth**: involuntary (blood vessels, stomach, intestine, bladder)
3. **Skeletal**: striated, **voluntary**. Keeps posture, moves limbs, absorbs shock. About 40 % of body weight
   (434 muscles, 75 pairs control movement). At rest they use about 18 % of the body's energy. **Efficiency ≈ 25 %**; the rest becomes heat.

Properties: **extensibility, elasticity, irritability** (responds to stimulus), **contractility**.
Tendon = muscle to bone. Ligament = bone to bone. Cartilage = smooth elastic padding.

### Movements and muscle roles
- Flexion (joint angle decreases) / extension (increases); abduction (away from the midline) / adduction;
  pronation (palm down) / supination (palm up); dorsiflexion / plantarflexion; eversion / inversion; elevation / depression;
  protraction / retraction.
- **Agonist** (prime mover, e.g. biceps brachii and brachialis for elbow flexion), **synergist** (helper, brachioradialis),
  **antagonist** (opposes, triceps), **stabilizer** (e.g. rhomboids hold the scapula), **neutralizer** (cancels
  unwanted actions, e.g. pronator teres cancels the biceps' supination when only flexion is wanted).

### Types of muscle activity (HW1 Q3)
| | Muscle length | Joint motion | Work | Push-up phase |
|---|---|---|---|---|
| **Isometric** | constant | none | none (but costs energy, "static work") | holding the plank or the bottom position |
| **Isotonic concentric** | shortens | yes | **positive** (overcomes load) | pushing up (pectorals and triceps shorten) |
| **Isotonic eccentric** | lengthens while tensed | yes | **negative** (brakes, controls speed) | lowering down slowly |
Also: **isokinetic** (constant velocity; isokinetic machines) and **isoinertial** (constant load, e.g. gravity).

### Torque at a joint
Only the component perpendicular to the bone makes torque:
$$T_m = F_m \sin\alpha \cdot d_\perp$$
Example (slides): 400 N at 60°, 3 cm → 346.4 N × 0.03 m = **10.4 N·m**.
- The torque is maximal when the muscle pulls at 90° to the bone.
- The **parallel component** ($F_m\cos\alpha$) makes no torque. It **stabilizes** the joint (pulls the bones together)
  when the elbow angle is above 90° and **dislocates** (pulls apart) when the elbow is flexed below 90°.

### Maximum force
- About **90 N/cm²** of physiological cross-sectional area (PCSA). The slides also quote 70 N/cm² for running and 100 N/cm² isometric in the quadriceps.
  4 cm² → 360 N; 10 cm² → 900 N; 12 cm² → 1080 N.
- In the first ~12 weeks of training, strength gains come from better **innervation**, not a bigger cross-section.
- **Power** = force × shortening velocity. **Maximum power at ≈ 1/3 of max velocity** (and about 1/3 of max force). Train there.
- Optimal muscle temperature is **38.5 °C**. Warm-up shifts the force-velocity curve; overheating risks heat stroke.

### Fibre arrangement: parallel vs pennate
$$F_\text{tendon} = F_\text{fibres}\cos\alpha \qquad A_m = \frac{V}{L_f}\qquad A^*_m = A_m\cos\alpha$$
| | Parallel (fusiform, long fibres) | Pennate (short fibres at angle α) |
|---|---|---|
| Force | Low | **High** (many more fibres per volume) |
| Shortening / speed / position control | **High** | Low |
| Elastic energy saving (tendon) | Low | **High** |
| ATP cost per force | **High** (long fibres need more cross-bridges in series) | Low |
Sample: same volume V₀, 10 vs 1 unit fibre length, α = 0 vs 20° → effective area 0.1 V₀ vs 0.94 V₀. So pennate gives about 9.4× the force.
A cos α penalty is small compared with the gain in area.

### Musculotendinous unit (3-element model)
- **Contractile component**: muscle fibres develop tension.
- **Series elastic component (SEC)**: tendon, which stores elastic energy.
- **Parallel elastic component (PEC)**: muscle membrane and connective tissue, which resist passive stretch.

### Hierarchy and sliding filament
Muscle → fascicle → muscle fibre (cell, 10–100 µm diameter, up to 30 cm long) → myofibril → **sarcomere** (2–3 µm, Z-line to Z-line) →
thick **myosin** and thin **actin** filaments (with tropomyosin and troponin).
- **Bands**: A band = dark, the length of the myosin, **does not change**. I band = light, actin only, **shrinks**.
  H zone = myosin only, **shrinks**. M line in the middle, Z lines at the ends.
- **Sliding filament theory** (Huxley): the filaments themselves do not shorten; they slide past each other.
- **Cross-bridge cycle**: a myosin head attaches to actin, swivels (power stroke, "hand over hand" like pulling a rope),
  then detaches. **ATP is needed for detachment.** Force ∝ the number of attached cross-bridges.

### Activation
- **Motor unit** = one motor neuron plus all the muscle fibres it innervates.
- **Twitch**: latent period (1–2 ms, Ca²⁺ release) → contraction → relaxation (10–100 ms).
- **Wave summation**: a higher firing frequency raises the tension → unfused tetanus → **fused tetanus** (maximum).
- **Recruitment**: more motor units give more tension. Only about 1/3 of motor units are used at once. **Asynchronous firing** gives smooth
  contraction and prevents fatigue.

### Length-tension (force-length)
- The best overlap is at about **70–130 % of the sarcomere's resting length**. Too short: myosin hits the Z disc. Too long: there is no overlap and no cross-bridges.
- Single fibre: a slight stretch maximizes force. Parallel muscle: maximum just above rest length. Pennate muscle: maximum at **120–130 %** of rest length.
- A prior stretch (initial tension) gives a faster and stronger contraction through elastic recoil.

### Force-velocity
- **Concentric**: force falls as shortening speed rises, because cross-bridges have less time to attach.
- **Isometric**: the reference point (v = 0).
- **Eccentric**: force is greater than isometric, because the elastic components help brake.

### Fibre types
| | Type I slow oxidative | Type IIa fast oxidative-glycolytic | Type IIx fast glycolytic |
|---|---|---|---|
| Myosin ATPase | slow | fast | fast |
| Size | small | medium | large |
| Fatigue | resistant | resistant | **easily fatigued** |
| Energy | aerobic | both | anaerobic |
| Capillaries / mitochondria | high | medium | low |
| Colour | red (myoglobin) | red | white |
Examples: **eye (ocular) muscle**: fast, about 1/50 s twitch; **gastrocnemius**: mixed, about 1/15 s, used for sprinting and jumping;
**soleus**: slow, about 1/5 s, used for standing posture.

### Stretch-shortening cycle (SSC)
1. **Eccentric phase**: pre-stretch and store elastic energy in the SEC (tendon).
2. **Amortization**: the transition, which must be short or the energy is lost as heat.
3. **Concentric phase**: the stored energy adds to the force, beyond an isolated concentric action.
Example: the long jumper's gastrocnemius at touchdown.

**Likely exam angles:** joint torque calculation; tendon force of a pennate muscle; PCSA × 90 N/cm²; parallel vs pennate
comparison; sliding filament (what shortens and what doesn't); contraction types for a given exercise; force-velocity and
force-length explanations; fibre types; SSC.

---

## Week 3 — Skeleton and springs

### Media and physics
- Air vs water: water is about 833× denser and about 56× more viscous. Gravity matters most on land and in air. In water, drag and oxygen
  supply limit locomotion.
- F = ma, W = Fd, P = dW/dt = Fv.

### Three types of skeleton
1. **Hydrostatic skeleton**: a fluid-filled sac or tube surrounded by muscle (sea anemone, earthworm, jellyfish).
2. **Muscular hydrostat**: a fixed volume of incompressible *tissue*, with no fluid cavity (tongue, elephant trunk, octopus arm,
   squid tentacle). It can bend, twist, elongate and lift.
3. **Exoskeleton**: a hard outer shell or cuticle (molluscs, arthropods). A **hollow tube supports more weight than a solid rod of equal
   weight**. The drawback is that it must **molt** to grow. Muscles sit *inside* and must cross the joint. Arthropods have no kneecap, so they
   work at a high distance advantage. Insect flight muscles shorten only about 4 % at 20–100 Hz; the **thorax** acts as a lever to sweep
   the wing about 120°.
4. **Endoskeleton**: bone and cartilage inside the body (vertebrates). It supports the body, protects organs, acts as levers, hosts marrow, and stores calcium
   and phosphorus. Humans have 206 bones (axial + appendicular).

### Material properties
Stress = F/A, strain = ΔL/L₀, modulus E = slope. Toughness = energy absorbed before fracture. Brittle materials break at small strain; tough ones absorb more energy.
Mammalian compact bone: tensile strength 150–180 MPa, E 18–20 GPa, failure strain about 0.9 %.

### Springs in animals (passive support and recoil "for free")
- **Clam or scallop**: an elastic **hinge pad**. The adductor muscle closes the shell and compresses the pad; when the muscle relaxes, the pad opens the shell.
- **Jellyfish**: elastic fibres in the bell. The circular muscle contracts and jets water out, then the bell recoils and re-extends the muscle.
- **Horse or giraffe**: the **nuchal ligament** supports the head and neck, which saves muscle tension and metabolic energy.
- **Achilles tendon** (human, kangaroo): stores the kinetic energy of foot strike and recoils to propel. Model: a bouncing ball.

### Hydrostatic mechanics
- Earthworm: segments separated by **septa**, with circular and longitudinal muscle layers. **Peristalsis**: a backward-travelling wave.
  Short, fat segments anchor (with bristles, *setae*) while long, thin segments push forward.
- Circular muscle contraction → body gets **thinner and longer**. Longitudinal muscle contraction → **shorter and thicker**.
- **Thin-walled pressurized cylinder** (radius r, wall t, pressure p):
  $$\sigma_L = \frac{pr}{2t},\qquad \sigma_C = \frac{pr}{t} = 2\sigma_L$$
  The hoop stress is twice the longitudinal stress, which is why a sausage splits lengthwise.
- **Hydraulic leverage** (constant volume, $V=\pi r^2 L$):
  $$\frac{dL}{L} = -2\frac{dr}{r}\qquad\Longrightarrow\qquad \frac{dL}{dr} = -\frac{2L}{r}$$
  A 10 % diameter decrease gives about 23 % lengthening exactly ($1/0.9^2 = 1.235$). The **displacement amplification
  2L/r is largest for a long, slender cylinder**. That is why squid tentacles are long and thin (HW2 Q1).

### Fibre-wound bodies and McKibben muscles
- Helical, inextensible fibres. **θ < 54.7°** (measured from the long axis): pressurizing makes the body **shorten**.
  **θ > 54.7°**: it **lengthens**. Purely longitudinal fibres prevent lengthening; purely circumferential fibres prevent shortening.
  The nematode has fibres at 76°, so it cannot shorten; it only bends using dorsal and ventral longitudinal muscles.
- **McKibben pneumatic artificial muscle**: a rubber bladder inside a braided mesh of inextensible threads (length b, n turns).
  $$L = b\cos\theta,\quad n\pi D = b\sin\theta,\quad V = \frac{b^3}{4\pi n^2}\sin^2\theta\cos\theta$$
  $$F = -P\frac{dV}{dL} = \frac{P b^2}{4\pi n^2}\left(3\cos^2\theta - 1\right)$$
  F = 0 at $\cos\theta = 1/\sqrt3$, so **θ* = 54.7°** (the "magic angle"), where the volume is maximum.
  Starting with θ < 54.7°, inflation makes the muscle **contract and pull**, and θ rises toward 54.7°.

### Joints, origins, insertions, levers
- **Origin** = less movable end; **insertion** = more movable end (gastrocnemius: origin on the distal femur, insertion on the calcaneus).
- Agonist, antagonist, synergist, **fixator** (stabilizes the agonist's origin).
- Each bone is a **lever** and each joint is a **fulcrum**.
  - Mechanical advantage MA = F_out/F_in; distance advantage DA = u_out/u_in.
  - **Work and power are conserved**: $F_\text{out}u_\text{out} = F_\text{in}u_\text{in}$, so MA × DA = 1.
  - **Class 1**: fulcrum between effort and load (head nodding, pry bar).
  - **Class 2**: load between fulcrum and effort, MA > 1 (wheelbarrow, rising on tiptoe).
  - **Class 3**: effort between fulcrum and load, **DA > 1, MA < 1** (elbow and biceps, tongs). Most limbs are class 3: built for speed.
- Numbers on the slides: front teeth DA 3.5; molars DA 1.7; **quadriceps DA 17.5**; gastrocnemius DA 2.3.

**Likely exam angles:** skeleton type comparison; springs in animals; pressure-vessel stresses; hydraulic leverage
(constant volume); McKibben derivation and the 54.7° angle; lever classes, MA and DA calculations.

---

## Week 4 — Walking

### Legged locomotion basics
- Legs are oscillating levers, struts, springs and cushions (Hildebrand). There is no kinetic friction if the foot doesn't slip.
- Average limb force at rest = W/n. In motion the ground reaction is **impulsive**: $I=\int F\,dt$ and $\bar F = I/\tau$, so $F_{\max} > W/n$.
- Stance sequence: **heel strike** (braking) → **mid-stance** (vertical, supports weight) → **toe-off** (propulsive).
- **Effective mechanical advantage EMA = r/R**, where r is the muscle moment arm and R is the ground-reaction moment arm. A crouched (Z-shaped) limb has a low EMA, which gives a distance advantage.
  An upright (L-shaped, straight) limb has an EMA near 1, which is good for weight support.
- **Wheel**: x = rθ, v = Rω, the centre of mass stays at constant height, and there is no bouncing. **Legs vs wheels**: legs handle variable terrain and
  obstacles, are energy efficient, can be driven by linear muscles, and need no continuous rotation or gears.

### Gait terms
- **Stride length**: footprint to the next print of the *same* foot. **Step**: the distance moved while the foot is on the ground.
- **Stride frequency**; **stance phase** (foot on ground) and **swing phase** (foot in air).
- **Duty factor** = stance time / stride period.
  Tortoise: 3 legs on the ground, 1 swinging, so DF = **0.75**. **Walking: DF > 0.5. Running: DF < 0.5.**
- Horse gaits: walk → trot (diagonal pairs) → canter → gallop. For ponies, walking is cheapest below **1.7 m/s**, trotting between 1.7 and 4.6 m/s, galloping above 4.6 m/s.
- Human gait cycle: initial contact → foot flat → mid-stance → heel lift → toe-off → swing. The foot is pronated at contact (absorbs shock)
  and supinated at push-off (a rigid lever).

### Inverted pendulum and maximum walking speed
The hip moves on an arc of radius L over the stance foot. The foot stays on the ground only if gravity can supply the centripetal force:
$$mg - R = \frac{mv^2}{L},\quad R\ge 0\;\Rightarrow\; v_{\max} = \sqrt{gL}$$
- Adult, L = 0.9 m: **2.97 m/s**. Child, L = 0.45 m: 2.1 m/s (the slides say 2.2), so the child must run.
  Moon (g = 1.6): 1.2 m/s, which is why Apollo astronauts hopped.
- **Racewalkers** exceed 4 m/s by flattening the hip path, giving an effective radius greater than L.
- In ideal walking, kinetic and potential energy exchange like a pendulum: ΔPE = mgL(1 − cos θ) = ΔKE. Work is needed only at heel strike and toe-off.

### Synthetic (rimless) wheel model
- Massless legs, mass at the hip. The stance leg rotates like an inverted pendulum at constant Ω: $\theta_C = -\alpha+\Omega t$.
  Stance period $\tau = 2\alpha/\Omega$; speed $V = 2L\alpha/\tau = L\Omega$.
- The swing leg is a free pendulum: $\theta_F = \alpha\cos\omega_F t + (\Omega/\omega_F)\sin\omega_F t$. It must reach −α at t = τ:
  $$-1 = \cos(\omega_F\tau) + \frac{2}{\omega_F\tau}\sin(\omega_F\tau)\;\Rightarrow\;\omega_F\tau = 4.058$$
  **Duty factor = 4.058/2π ≈ 0.65 ≈ 2/3.** The cycle period does not depend on step length.
- Pendulum frequencies:
  - point mass at the foot: $f=\frac1{2\pi}\sqrt{g/L}$
  - **uniform leg (compound pendulum)**: $f=\frac1{2\pi}\sqrt{3g/2L}$, so $T = 2\pi\sqrt{2L/3g}$
- Passive walking toys walk down ramps powered only by gravity.

**Likely exam angles:** derive $v_{\max}=\sqrt{gL}$ and apply it (child, moon, Mars); gait definitions and duty factor;
legs vs wheels; EMA; stance-phase sequence; synthetic wheel (τ, V, DF ≈ 2/3); pendulum frequency of a leg.

---

## Week 5 — Running and jumping

### Walking → running
- Above about $\sqrt{gL}$ ≈ 3 m/s a person breaks into a run. Energetically, running becomes cheaper than walking above about **2.3 m/s** (Margaria).
- Running: each foot is on the ground **less than half** the time and there is a flight phase. Walking: more than half, with double support.
- Running cycle: stance about **40 %**, then float 15 % + swing 30 % + float 15 %. The stance knee **never straightens** (it is straight in walking).
- **Ground reaction force**: slow walk has a plateau; moderate walk has **two humps**; running has a **single hump** (with a small impact spike).
  Marathon pace (4.5 m/s) peak is about **2.7 mg** (≈ 1900 N for 70 kg); sprinting is about 3.6 mg. The Achilles tendon carries about 4700 N.
- About 100 J of kinetic energy is lost per foot strike. About **35 J is stored in the Achilles tendon** and about 93 % of that is recovered.
- Ostriches beat humans: mostly slow-twitch muscle, long (≈ 80 cm) tendons that store about 83 % more work, and running on their toes.
- Legs are much costlier than wheels: a cyclist uses less than half the power of a runner at the same speed. Air drag is at most about 13 % of a sprint's power.

### Sprott's energetics model
- Walking: the legs swing at their natural period T. Energy mgΔh is spent raising the centre of mass once per step and is not recovered.
  $$N = m\left(g-\frac{v^2}{L}\right),\quad v_y(0) = \left(g-\frac{N}{m}\right)\frac T4,\quad P = \frac{mg\,v_y(0)}{4}\;\Rightarrow\; P_W = \frac{mg}{4}\frac{v^2}{L}\frac{T}{4}$$
  Running: $P_R = mg\,v_y(0)/4$ with $v_y(0) ≈ v_x$ (best range at 45°). Running power is **∝ v** (linear); walking power is **∝ v²**.
  The two curves cross, and the crossing is the walk-to-run transition.
- Alternative "pendulum" form on the lecture slide (boxed):
  $$P_W = \frac{mg\Delta h}{T/2},\quad P_W = mgL\frac{\pi}{2}\sqrt{\frac{3L}{2g}}\left(\frac{\bar v}{L}\right)^2$$
  ⚠️ The slides write the period both as $2\pi\sqrt{2L/3g}$ (in the text, and the physically correct compound-pendulum period) and as
  $2\pi\sqrt{3L/2g}$ (in the formula). When you answer, write down which one you use.

### Sprint acceleration model (stride-by-stride energy method)
Body mass $m_b$, each leg $m_\text{leg}$, horizontal propulsive force F over stride length L:
- Stride 1: $FL = \tfrac12(m_b-m_\text{leg})v_1^2$ (the upper body and swing leg reach v₁; the stance leg stays at about 0).
- Stride 2: $FL = \tfrac12(m_b-2m_\text{leg})(v_2^2-v_1^2) + \tfrac12 m_\text{leg} v_2^2$
- In general: $v_n^2 = \frac{2FL}{m_b-m_\text{leg}}\cdot\frac{1-r^n}{1-r}$ with $r = \frac{m_b-2m_\text{leg}}{m_b-m_\text{leg}}$
- **Top speed**: $v_\text{final} = \sqrt{2FL/m_\text{leg}}$. At top speed, all the work each stride goes into re-accelerating a leg from rest.
  Slide example: 70 kg, m_leg = 0.161 m_b, F = 560 N, L = 1 m → 10 m/s.

### Spring-mass model of running
A point mass bouncing on a massless spring (like a pogo stick). The centre of mass is lowest and the force is greatest at mid-stance.
At middle-distance speeds, about half the work comes from passive springs (tendons and ligaments) and half from muscle.

### Jumping
- Countermovement (squat first) increases muscle recruitment and uses the SSC. Phases: countermovement → push-off → aerial → collision → recovery.
- Squat jump vs countermovement jump vs catapult jump (tendon pre-loaded): the countermovement and catapult jumps produce higher ground force.
- **Jump height (energy method)**:
  $$\int_0^s F_V\,dz = \tfrac12 m v_{TO}^2 = mgH,\quad F_V = N-mg\;\Rightarrow\; H = \frac{(N-mg)s}{mg}$$
  Slide example: mg = 620 N, N = 1334 N (136.1 kgf), s = 0.43 m → H ≈ 0.49 m.
- **Take-off time** (constant acceleration): $a = (N-mg)/m$, $v_{TO} = a\tau$, $s = \tfrac12 a\tau^2$, so $\tau = \sqrt{2s/a}$.

**Likely exam angles:** walking vs running differences (DF, knee, GRF shape); why running starts; Sprott power formulas;
the sprint stride model (v₁, v₂, v_final); Usain Bolt energy method (HW2 Q4); jump height and take-off time.

---

## Homework themes recap (very likely to reappear)
| HW | Question | Topic |
|---|---|---|
| 1 Q1–2 | Soft vs hard robots, xylophone mallet | Week 1 |
| 1 Q3 | Push-up: isometric / concentric / eccentric | Week 2 |
| 1 Q4 | Pennate tendon force $F\cos\alpha$ | Week 2 |
| 1 Q5 | Forearm with two elastic actuators: moment balance + Hooke + geometry | Weeks 2–3 |
| 2 Q1 | Squid tentacle hydraulic leverage (constant volume) | Week 3 |
| 2 Q2 | McKibben principle, 54.7° | Week 3 |
| 2 Q3 | $v_{\max}=\sqrt{gL}$ and walking power | Weeks 4–5 |
| 2 Q4 | Usain Bolt: energy method for propulsive force | Week 5 |

Full worked solutions are in [03-homework-solutions.md](03-homework-solutions.md).

---

## Final checklist: can you do these without notes?
Tick each one off the day before the exam. Everything here comes from weeks 1–5.

**Week 1**
- [ ] List 3 advantages and 3 disadvantages of rigid robots, and 3 advantages of soft robots plus the main challenge (control).
- [ ] Compare hydraulic, electric and pneumatic drives, and explain why pneumatics drift under load.
- [ ] Compute a harmonic-drive ratio from the tooth counts, including the direction.
- [ ] Explain why motor-driven arms have a poor payload-to-weight ratio (motor density 7–9× muscle; biceps 2.7 vs UR10e 0.37).

**Week 2**
- [ ] Compute joint torque $F\sin\alpha\,d$ and say what the parallel component does.
- [ ] Compute max force from PCSA × 90 N/cm², and tendon force $F\cos\alpha$ for a pennate muscle.
- [ ] Show with $A = V/L_f$ why pennate muscles give more force than parallel ones of the same volume.
- [ ] Classify isometric, concentric and eccentric actions in a push-up or chin-up.
- [ ] Explain the sliding filament model (what shortens), the role of ATP, force-length, force-velocity, twitch → tetanus, and the SSC.
- [ ] Compare type I, IIa and IIx fibres, with a muscle example for each.

**Week 3**
- [ ] Name the skeleton types with examples, and the springs in animals (clam, jellyfish, nuchal ligament, Achilles).
- [ ] Derive the pressure-vessel stresses $pr/2t$ and $pr/t$.
- [ ] Use constant volume for hydraulic leverage (exact and linearized), and explain HW2 Q1.
- [ ] Derive the McKibben force and the 54.7° angle.
- [ ] Classify the three lever classes and compute MA, DA and the muscle force for a held load.

**Week 4**
- [ ] Derive $v_{\max}=\sqrt{gL}$ and apply it on Earth, the Moon and Mars, and for a child.
- [ ] Define stride, step, stance, swing and duty factor (walk > 0.5, run < 0.5, tortoise 0.75).
- [ ] Use the synthetic-wheel relations ($\tau = 2\alpha/\Omega$, $V = L\Omega$, $\omega_F\tau = 4.058$) and the leg pendulum frequency.

**Week 5**
- [ ] List the differences between walking and running (duty factor, knee, GRF shape, flight phase).
- [ ] Compute walking or running power with Sprott's model.
- [ ] Use the stride-by-stride sprint model to get $v_1$, $v_2$, $v_\text{final}$ and the number of strides to a given speed, and redo HW2 Q4 (Bolt).
- [ ] Compute jump height and push-off time from N, m and s.

