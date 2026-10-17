# Flashcards — quick self-test (weeks 1–5)

Read the question, answer out loud, then click to reveal. Repeat the ones you miss.

## Week 1 — Soft robotics
<details><summary>1. Three advantages of rigid robots, and three disadvantages?</summary>
Pros: high load capacity, consistent properties under large forces, precise position control via rigid transmission. Cons: not universal (redesign per task), poor in unstructured or cluttered spaces, hard to force-control, overpowered and unsafe near humans.</details>

<details><summary>2. Why are soft robots inspired by the elephant trunk and the octopus?</summary>
They are muscular hydrostats with no skeleton, but they bend, elongate, twist and lift with strength. They manipulate objects continuously and safely.</details>

<details><summary>3. How does a soft arm deform under a tip moment vs under self-weight?</summary>
A tip moment bends it upward in a quadratic shape; self-weight bends it downward in a cubic shape. Combined, the tip can be at zero but the arm is not straight.</details>

<details><summary>4. What limits the maximum stress of a pneumatic actuator vs an EAP actuator?</summary>
Pneumatic: the fracture strength of the rubber holding the pressure. EAP: the strength of the polymer.</details>

<details><summary>5. Harmonic drive with 100 flexspline teeth and 102 circular spline teeth?</summary>
(100−102)/100 = −0.02, so a 50:1 reduction with reversed direction. No backlash, compact, coaxial.</details>

<details><summary>6. Which drive suits large robots, small pick-and-place robots, and precise medium robots?</summary>
Hydraulic; pneumatic (drifts under load); electric (servo or stepper; a stepper works open loop).</details>

<details><summary>7. How does the Robot Institute of America define an industrial robot?</summary>
A programmable, multifunction manipulator designed to move material, parts, tools or special devices through variable programmed motions for the performance of a variety of tasks.</details>

<details><summary>8. Payload-to-self-weight ratio of the human biceps vs robot arms, and why?</summary>
Biceps 10 kg / 3.7 kg ≈ 2.7; KINOVA Gen2 ≈ 0.59; UR10e ≈ 0.37. Motors are copper and iron, 7–9× denser than muscle, and a ≈ F/m, so a heavy arm also accelerates poorly.</details>

## Week 2 — Muscles
<details><summary>9. What fraction of body mass is skeletal muscle, and what is its efficiency?</summary>
About 40–45 % of body mass; about 25 % efficiency (the rest becomes heat).</details>

<details><summary>10. Maximum muscle stress?</summary>
About 90 N/cm² of PCSA (70 in running, 100 isometric for the quadriceps).</details>

<details><summary>11. Which component of muscle force makes joint torque, and what does the other one do?</summary>
The perpendicular component F sin α makes torque. The parallel component F cos α stabilizes the joint (elbow angle above 90°) or dislocates it (flexed below 90°).</details>

<details><summary>12. Pennate vs parallel: force, speed, ATP cost?</summary>
Pennate: more force (more fibres per volume, despite the cos α loss), less shortening, cheaper ATP per force, better elastic storage. Parallel: the opposite.</details>

<details><summary>13. What shortens during contraction: A band, I band, H zone?</summary>
The I band and H zone shrink. The A band stays the same. The filaments slide; they don't shorten.</details>

<details><summary>14. Role of ATP?</summary>
It detaches the myosin head from actin and re-cocks it for the next power stroke.</details>

<details><summary>15. Three phases of a twitch?</summary>
Latent (1–2 ms, Ca²⁺ release), contraction, relaxation (10–100 ms).</details>

<details><summary>16. Tetanus?</summary>
Firing so fast that the muscle has no time to relax. Twitches fuse into maximum sustained tension.</details>

<details><summary>17. Why is eccentric force greater than isometric force, which is greater than concentric force?</summary>
Concentric: faster sliding means fewer attached cross-bridges. Eccentric: the cross-bridges and elastic components resist the stretch and help braking.</details>

<details><summary>18. At what fraction of v_max is muscle power maximal?</summary>
About one-third of v_max (and about one-third of F_max).</details>

<details><summary>19. Optimal sarcomere length range?</summary>
About 70–130 % of resting length. Pennate muscles peak at 120–130 %.</details>

<details><summary>20. SSC phases?</summary>
Eccentric pre-stretch (store energy in the SEC/tendon), then a short amortization, then a concentric phase with the elastic recoil added.</details>

<details><summary>21. Type I vs IIx fibres?</summary>
I: slow, small, red, aerobic, fatigue-resistant, many mitochondria and capillaries. IIx: fast, large, white, anaerobic, fatigues easily.</details>

<details><summary>22. Three elements of the musculotendinous model?</summary>
Contractile component (fibres), series elastic component (tendon), parallel elastic component (membrane and connective tissue).</details>

<details><summary>23. Agonist, synergist, antagonist and neutralizer for elbow flexion?</summary>
Agonists: biceps brachii and brachialis. Synergist: brachioradialis. Antagonist: triceps brachii. Neutralizer: pronator teres cancels the biceps' supination when only flexion is wanted.</details>

<details><summary>24. Why does a pennate muscle give more force than a parallel one of the same volume? Give the slide numbers.</summary>
A = V/L_f, so short fibres give a much larger area. Slide example: fibre length 10 vs 1 unit at 0° vs 20° gives effective area 0.1 V vs 0.94 V, about 9× the force. The cos α loss is small.</details>

## Week 3 — Skeletons and springs
<details><summary>25. Hydrostatic skeleton vs muscular hydrostat?</summary>
Hydrostatic skeleton: a fluid-filled cavity inside a muscle wall (worm). Muscular hydrostat: a solid, incompressible mass of muscle at constant volume (tongue, trunk, tentacle).</details>

<details><summary>26. Hoop vs longitudinal stress in a pressurized cylinder?</summary>
σ_C = pr/t = 2σ_L, where σ_L = pr/2t.</details>

<details><summary>27. Hydraulic leverage formula?</summary>
dL/L = −2 dr/r (constant volume), or exactly L₂/L₁ = (D₁/D₂)². A 10 % thinner cylinder is 23 % longer. The amplification 2L/r is largest when slender.</details>

<details><summary>28. Circular vs longitudinal muscle contraction in a worm?</summary>
Circular: longer and thinner (projects forward). Longitudinal: shorter and fatter (anchors with setae). A peristaltic wave travels backward.</details>

<details><summary>29. McKibben critical angle, and why?</summary>
54.7° = arccos(1/√3). F ∝ 3cos²θ − 1, which is zero there, and the volume is maximum. Below it, inflation contracts; above it, inflation extends.</details>

<details><summary>30. Why can't an exoskeleton animal grow continuously? What helps insect flight?</summary>
A rigid cuticle can't expand, so it must molt. The thorax acts as a lever: about 4 % muscle shortening sweeps the wing about 120°.</details>

<details><summary>31. Four elastic elements in animals?</summary>
Clam hinge pad, jellyfish bell fibres, nuchal ligament, Achilles tendon.</details>

<details><summary>32. Origin vs insertion?</summary>
Origin: the less movable end. Insertion: the more movable end (gastrocnemius: femur → calcaneus).</details>

<details><summary>33. Lever classes and examples?</summary>
1: fulcrum in the middle (nodding head). 2: load in the middle, MA > 1 (wheelbarrow, tiptoe). 3: effort in the middle, DA > 1 (elbow, quadriceps with DA 17.5).</details>

<details><summary>34. Why does a hollow tube support more than a solid rod of the same weight?</summary>
Material far from the bending axis carries the load best. With the same cross-sectional area, a tube of outer radius 2r₀ has 7× the second moment of area of a solid rod of radius r₀. That is why exoskeletons are tubes.</details>

<details><summary>35. What happens to a McKibben muscle's braid angle as it is inflated, and when does it stop pulling?</summary>
θ (from the long axis) increases as the diameter grows and the length shrinks. It stops at 54.7°, where F = 0 and the volume is maximum. Starting above 54.7°, inflation extends it instead.</details>

## Week 4 — Walking
<details><summary>36. Maximum walking speed, and its value for L = 0.9 m?</summary>
√(gL) = 2.97 m/s. Moon: 1.2 m/s.</details>

<details><summary>37. Duty factor for walking vs running, and for a tortoise?</summary>
Walking > 0.5, running < 0.5. Tortoise 0.75.</details>

<details><summary>38. Synthetic-wheel key number?</summary>
ω_F τ = 4.058, so the duty factor is ≈ 0.65 ≈ ⅔, and the period does not depend on step length.</details>

<details><summary>39. Pendulum frequency of a uniform leg?</summary>
f = (1/2π)√(3g/2L), so T = 2π√(2L/3g).</details>

<details><summary>40. EMA of a crouched vs a straight leg?</summary>
Crouched (Z-shape): EMA = r/R ≪ 1, distance advantage. Straight (L-shape): EMA near 1, good weight support.</details>

<details><summary>41. Why must a child run to keep up with an adult who is walking?</summary>
v_max = √(gL). A child with L = 0.45 m can walk at most ≈ 2.1 m/s, while an adult with L = 0.9 m can walk up to ≈ 2.97 m/s.</details>

<details><summary>42. Advantages of legs over wheels?</summary>
Legs handle variable terrain and obstacles, are energy efficient, can be driven by linear muscles, and need no perpetual rotation or gears. A wheel keeps the centre of mass level but needs a prepared surface.</details>

## Week 5 — Running and jumping
<details><summary>43. Walk vs run: GRF pattern and knee?</summary>
Walking: two humps (plateau when slow) and a straight stance knee. Running: one hump (≈ 2.7–3.6 mg) and a knee that is never straight.</details>

<details><summary>44. Energetic walk-run crossover?</summary>
About 2.3 m/s. Walking power ∝ v² and running power ∝ v, so the curves cross.</details>

<details><summary>45. Sprint top speed formula?</summary>
v_final = √(2FL/m_leg): at top speed all the stride work goes into re-accelerating a leg.</details>

<details><summary>46. Jump height formula, and take-off time?</summary>
H = (N − mg)s/(mg). τ = √(2s/a) with a = (N − mg)/m.</details>

<details><summary>47. How much energy does the Achilles tendon store per step at marathon pace?</summary>
About 35 J of about 100 J lost per foot strike, with about 93 % recoverable.</details>

<details><summary>48. Phases of the running cycle, with percentages?</summary>
Stance ≈ 40 % (from foot strike), then float ≈ 15 %, swing ≈ 30 %, float ≈ 15 % until the next foot strike. The stance knee never fully straightens.</details>

<details><summary>49. Four stages of the stick-man vertical jump?</summary>
Stand upright (COM ≈ 1.0 m) → crouch (COM ≈ 0.65 m) → extend onto tiptoe (COM ≈ 1.05 m, take-off at v_TO) → free flight up to height H, where v = 0.</details>

<details><summary>50. Why are ostriches better runners than humans?</summary>
Mostly slow-twitch muscle for endurance, long (≈ 80 cm) tendons that store ≈ 83 % more elastic work, muscle mass kept high on the leg (light distal leg), and they run on their toes.</details>
