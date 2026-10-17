# Practice Midterm B — Bioinspired Soft Robotics

**Time:** 120 minutes · **Total:** 100 points · Calculator allowed · Use g = 9.81 m/s² unless stated.
Show your formulas, assumptions and units.
Solutions: [practice-exam-B-solutions.md](practice-exam-B-solutions.md).

---

### Question 1 — Robot drives (10 pts)
(a) Name the four main parts of an industrial robot, and compare hydraulic, electric and pneumatic drives (size of robot, speed and strength,
drawbacks). (5)
(b) A harmonic drive has a flexspline with 160 teeth and a circular spline with 162 teeth. The wave generator turns at 3000 rpm. Find the
reduction ratio and the output speed and direction. (3)
(c) Why does a pneumatic gripper "drift" under load while a hydraulic one does not? (2)

### Question 2 — Muscle organization (10 pts)
(a) Name the three types of muscle tissue and state for each whether it is striated and whether it is under voluntary control. (3)
(b) For **elbow flexion** with the forearm supinated, name an agonist, a synergist and an antagonist. Explain what a **neutralizer** does,
with the biceps as the example. (4)
(c) The soleus, gastrocnemius and ocular muscles differ in fibre type and twitch speed. Rank them from fastest to slowest, give approximate twitch
durations, and relate each to its function. (3)

### Question 3 — Contraction and force-velocity (10 pts)
(a) For a chin-up, classify the biceps' activity while (i) pulling up, (ii) hanging still at the top, (iii) lowering slowly. (3)
(b) Sketch the force-velocity curve of skeletal muscle, including the eccentric region. Explain its shape using the cross-bridge theory. (4)
(c) A muscle has maximum isometric force 1200 N and maximum shortening speed 0.6 m/s. Using the lecture rule of thumb, estimate its maximum
mechanical power. At what speed should it be trained for power? (3)

### Question 4 — Skeletons and springs (12 pts)
(a) Describe the three (or four) types of skeleton, with one animal example each. What is the main drawback of an exoskeleton? (3)
(b) The lecture states that a hollow tube supports more than a solid rod of equal weight. Show this for bending: compare the second moment of area of a
solid rod of radius r₀ with a tube of **the same cross-sectional area** and outer radius 2r₀. (4)
*(Use $I_\text{rod} = \frac\pi4 r_0^4$, $I_\text{tube} = \frac\pi4(R_o^4 - R_i^4)$.)*
(c) Give three examples of elastic "springs" in animals and say what energy or effort each one saves. (3)
(d) A nematode's cuticle fibres run at 76° to its long axis. What happens to its length when its internal pressure rises? How does it move? (2)

### Question 5 — Levers in the body (8 pts)
The quadriceps acts on the leg with a distance advantage of 17.5.
(a) If the quadriceps shortens by 5 cm at 0.5 m/s while exerting 1000 N, find the displacement, speed and force at the foot. (4)
(b) Why are most limb muscles arranged as class-3 levers? (2)
(c) Give an example of a class-2 lever in the human body. (2)

### Question 6 — Gait and the synthetic wheel (12 pts)
(a) Define *stride length*, *stance phase*, and *duty factor*. (3)
(b) A synthetic-wheel walker has leg length L = 0.9 m and swings each leg ±α = ±20° about vertical during stance. Treat the swinging leg as a uniform rod
(compound pendulum), and use $\omega_F\tau = 4.058$. Calculate the swing natural frequency $\omega_F$, the stance duration τ, the angular speed Ω,
the walking speed V and the step length. (6)
(c) Describe how the vertical ground reaction force of one foot changes from slow walking to fast walking to running. (3)

### Question 7 — Sprint acceleration (14 pts)
An 80 kg sprinter has legs of m_leg = 0.161 m_b **each**. Each stride (length L = 1.0 m) the stance foot provides a horizontal propulsive force
F = 500 N. Use the lecture's stride-by-stride energy model: the stance leg is at rest, while the swing leg moves with the upper body.
(a) Find the speed v₁ after the first stride. (3)
(b) Find v₂ after the second stride. (3)
(c) Find the limiting top speed. (3)
(d) After how many strides does the sprinter reach 95 % of top speed? (3)
(e) In one or two sentences: why is legged locomotion so much costlier than cycling at the same speed? (2)

### Question 8 — Elastic actuator at the elbow (12 pts)
A robotic forearm is horizontal and pinned at the elbow C. A single linear elastic actuator (spring constant k = 20 kN/m) is attached
b = 4 cm from C and pulls **vertically upward** from a fixed point far above. A load mg = 20 N hangs at L = 30 cm from C, on the same side.
Neglect the forearm's weight.
(a) Calculate the actuator tension needed to hold the forearm horizontal. (3)
(b) Calculate the force at the elbow pin, and give its direction. (2)
(c) If the actuator's rest length is fixed, how much must it be stretched to carry that tension? (2)
(d) The forearm is now lowered slowly by 30° while holding the same load. The actuator stays almost vertical. By how much does it lengthen,
and what tension is needed at 30°? If the actuator were a passive spring, what tension would it have, and what would happen? What must the
actuator do instead? (3)
(e) What kind of muscle action does (d) correspond to? Why is the actuator force so much larger than the load? (2)

### Question 9 — Running mechanics and energetics (12 pts)
A 70 kg runner runs at marathon pace (4.5 m/s) with a step frequency of 3 steps/s.
(a) Estimate the peak vertical ground reaction force, using the lecture's rule of thumb. (2)
(b) About 100 J of kinetic energy is lost per foot strike. How much is stored in the Achilles tendon, how much of that comes back, and what power
does the tendon return? (3)
(c) Using Sprott's model, compute the running power if the centre of mass leaves the ground with $v_y(0) = 1.2$ m/s. (2)
(d) Give four differences between walking and running. (4)
(e) In the spring-mass model of running, where does the spring-like behaviour come from at middle-distance speeds? (1)
