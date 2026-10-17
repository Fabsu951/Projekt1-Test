# Practice Midterm B — Solutions

### Q1 (10)
(a) Parts: **controller** (the "brain" that runs the program), **arm/manipulator** (shoulder, elbow, wrist; one DOF per joint), **end effector** (gripper,
suction, magnet, tool), **drive** (+ **sensors**: tactile, proximity, vision).
| Drive | Robot size | Speed and strength | Drawbacks |
|---|---|---|---|
| Hydraulic | large | highest speed and strength | oil leakage, floor space for the pump |
| Electric (servo, stepper) | medium | less speed and strength, precise | needs gears (harmonic drive), heavy motors |
| Pneumatic | small | fast pick-and-place, cheap, simple | drifts under load, hard to control position |
(b) Ratio $= (160-162)/160 = -1/80$, so **80:1 reduction**, output **reversed**. Output speed $= 3000/80 = \mathbf{37.5\ rpm}$ in the opposite direction
to the wave generator.
(c) Air is **compressible**: a load change compresses the air in the cylinder, so the piston position changes even with the valves closed. Hydraulic oil is nearly
incompressible, so the piston holds its position.

### Q2 (10)
(a) **Skeletal**: striated, voluntary. **Cardiac**: striated, involuntary. **Smooth**: non-striated, involuntary.
(b) Agonists: **biceps brachii, brachialis**. Synergist: **brachioradialis**. Antagonist: **triceps brachii**. A neutralizer cancels an unwanted secondary
action of the agonist. The biceps both flexes the elbow and supinates the forearm; if only flexion is wanted, **pronator teres** contracts to cancel the
supination.
(c) Fastest to slowest: **ocular** (≈ 1/50 s; fast twitch for rapid eye fixation) > **gastrocnemius** (≈ 1/15 s; mixed fast and slow, for running and
jumping) > **soleus** (≈ 1/5 s; mainly slow type I, fatigue-resistant, for posture and standing).

### Q3 (10)
(a) (i) **Isotonic concentric** (the muscle shortens and does positive work); (ii) **isometric** (tension at constant length, no work); (iii) **isotonic
eccentric** (the muscle lengthens under tension, does negative work and brakes).
(b) Plot force against velocity (shortening to the right). The force is maximal isometric at v = 0 and falls hyperbolically to zero at v_max for shortening. For lengthening
(eccentric) the force rises *above* the isometric value and then plateaus (≈ 1.5–1.8× F₀).
Explanation: force ∝ the number of attached cross-bridges. Attachment takes finite time, so at faster sliding fewer bridges are attached and the force drops.
At slow speeds more bridges attach. During eccentric action, the stretched bridges and the elastic components resist and add force.
(c) Maximum power at about ⅓ v_max and about ⅓ F_max: $P_{\max} \approx (1200/3)(0.6/3) = 400\times0.2 = \mathbf{80\ W}$. Train at about **0.2 m/s** (one-third
of maximum velocity).

### Q4 (12)
(a) **Hydrostatic** (fluid-filled cavity in a muscular wall: earthworm, sea anemone, jellyfish); **muscular hydrostat** (incompressible tissue at
constant volume: tongue, elephant trunk, octopus arm); **exoskeleton** (outer shell or cuticle: crab, insect, clam); **endoskeleton** (internal bone and
cartilage: human, horse). Exoskeleton drawback: it can't grow, so the animal must **molt**, and it is vulnerable meanwhile.
(b) Same area: $\pi(R_o^2-R_i^2) = \pi r_0^2$ with $R_o = 2r_0$, so $R_i^2 = 3r_0^2$.
$$I_\text{tube} = \frac\pi4\left(16r_0^4 - 9r_0^4\right) = \frac{7\pi}{4}r_0^4 = \mathbf{7\,I_\text{rod}}$$
For the same mass (the same amount of material), the tube is 7× stiffer in bending (and stronger, since $\sigma = Mc/I$ gives a 3.5× lower peak stress).
Material far from the neutral axis does the most work.
(c) Any three: the **clam hinge pad** opens the shell when the adductor relaxes, so no opener muscle is needed; the **jellyfish bell's elastic fibres** re-expand the bell
after the jet stroke; the **nuchal ligament** (horse, giraffe) holds up the head and neck, saving muscle tension; the **Achilles tendon** stores
foot-strike kinetic energy and returns it at push-off (≈ 35 J stored of ≈ 100 J, ≈ 93 % recoverable).
(d) The angle is 76° > 54.7°, so a pressure rise tends to **lengthen** the body. It **cannot shorten**, because the near-circumferential fibres resist it. It moves by
**bending** (undulating) through alternating dorsal and ventral longitudinal muscle contraction.

### Q5 (8)
(a) Displacement $= 17.5\times0.05 = \mathbf{0.875\ m}$; speed $= 17.5\times0.5 = \mathbf{8.75\ m/s}$; force $= 1000/17.5 = \mathbf{57\ N}$ (power is conserved:
1000 × 0.5 = 57.1 × 8.75 = 500 W).
(b) Muscles can only shorten a little (a fibre shortens to ≈ ½ its rest length) and slowly. Class-3 levers give a **distance and speed advantage**, so a small,
compact muscle near the joint produces large, fast limb motion, and the limb stays light at its distal end (low inertia). The cost is a larger muscle force.
(c) **Rising on tiptoe**: the fulcrum is at the ball of the foot, body weight acts through the ankle, and the gastrocnemius pulls up on the calcaneus. So MA > 1.

### Q6 (12)
(a) **Stride length**: distance from one footprint to the next print of the *same* foot. **Stance phase**: the part of the cycle when the foot is on the ground.
**Duty factor**: stance time / stride period.
(b) Compound pendulum: $\omega_F = \sqrt{3g/2L} = \sqrt{3(9.81)/1.8} = \mathbf{4.04\ rad/s}$.
$\tau = 4.058/4.04 = \mathbf{1.00\ s}$. $\Omega = 2\alpha/\tau = 2(0.349)/1.00 = \mathbf{0.696\ rad/s}$.
$V = L\Omega = \mathbf{0.63\ m/s}$. Step length $= 2L\alpha = 2(0.9)(0.349) = \mathbf{0.63\ m}$ (or $2L\sin\alpha = 0.62$ m).
Duty factor = 4.058/2π ≈ 0.65 ≈ ⅔.
(c) Slow walking: the force rises quickly, then holds a **flat plateau** at about body weight, then falls. Moderate and fast walking: **two humps** (heel-strike
loading and toe-off push) with a dip at mid-stance, and the humps get sharper with speed. Running: a single, tall **one-hump** peak (≈ 2.5–3.6 mg) with a small
impact spike. Contact is short and there is a flight phase where neither foot touches the ground.

### Q7 (14)
$m_\text{leg} = 0.161\times80 = 12.88$ kg; $m_b - m_\text{leg} = 67.12$ kg; $m_b - 2m_\text{leg} = 54.24$ kg; $2FL = 1000$ J.
(a) $v_1 = \sqrt{2FL/(m_b-m_\text{leg})} = \sqrt{1000/67.12} = \mathbf{3.86\ m/s}$
(b) $r = 54.24/67.12 = 0.808$. $v_2^2 = \frac{2FL}{m_b-m_\text{leg}}(1+r) = 14.90\times1.808 = 26.94$, so $v_2 = \mathbf{5.19\ m/s}$.
(c) $v_\text{final} = \sqrt{2FL/m_\text{leg}} = \sqrt{1000/12.88} = \mathbf{8.81\ m/s}$
(d) $v_n^2 = v_f^2(1-r^n)$. For 95 %: $1-r^n = 0.9025$, so $r^n = 0.0975$ and $n = \ln0.0975/\ln0.808 = 10.9$. That is **11 strides**.
(e) Each stride the stance leg is stopped and must be re-accelerated from rest. That kinetic energy, ½ m_leg v² per stride, is mostly lost, along with the
centre-of-mass rise and fall. A wheel keeps the centre of mass level, needs no reciprocating mass, and loses only rolling and joint friction.

### Q8 (12)
(a) Moments about C: $F\,b = mg\,L$, so $F = \frac{20\times0.30}{0.04} = \mathbf{150\ N}$ (7.5× the load).
(b) Vertical balance: $F - mg + R = 0$, so $R = 20 - 150 = -130$ N. The pin pushes **down** on the forearm with **130 N**.
(c) $\delta = F/k = 150/20\,000 = \mathbf{7.5\ mm}$
(d) The attachment point drops by $b\sin30° = \mathbf{2.0\ cm}$, so the actuator lengthens by 2 cm.
Needed tension: $F\,b\cos30° = mg\,L\cos30°$, so the cos 30° cancels and it is still **150 N**.
A passive spring would have $150 + k(0.02) = 150 + 400 = \mathbf{550\ N}$, which is far too much, so it would pull the arm back up toward horizontal.
To lower the load in a controlled way, the actuator must **increase its rest length by about 2 cm** while keeping 150 N (variable tension), the same idea as HW1 Q5.
(e) **Eccentric** action: the actuator lengthens while under tension, braking the load, like the biceps lowering a weight.
It is a **class-3 lever**: MA = b/L = 4/30 = 0.13, so the actuator needs 7.5× the load, and in return the hand moves 7.5× faster and farther (distance advantage).

### Q9 (12)
(a) Peak ≈ 2.7 mg = 2.7 × 686.7 ≈ **1850 N** (≈ 1900 N on the slide for a 700 N runner; ≈ 3.6 mg when sprinting).
(b) Stored ≈ **35 J**, of which ≈ 93 % comes back: 35 × 0.93 ≈ **32.6 J** per step. At 3 steps/s the tendon returns ≈ 32.6 × 3 ≈ **98 W**,
power the muscles don't have to supply.
(c) $P_R = \frac{mg\,v_y(0)}{4} = \frac{686.7\times1.2}{4} = \mathbf{206\ W}$
(d) Any four: duty factor > 0.5 in walking vs < 0.5 in running; walking has double support, running has a **flight phase**; the stance knee is
straight in walking (inverted pendulum) but **never straight** in running (spring); the GRF has **two humps** in walking vs **one tall hump** (≈ 2.7–3.6 mg)
in running; kinetic and potential energy are **out of phase** in walking (pendulum exchange) but stored as **elastic energy** in running; above
≈ 2.3 m/s running is cheaper; walking is limited by $v_{\max} = \sqrt{gL}$.
(e) From elastic stretch and recoil of the **tendons and ligaments** (e.g. Achilles) and from non-elastic lengthening and shortening of the
muscles: at middle-distance speeds roughly **half** the work comes from the passive springs and half from the muscles.
