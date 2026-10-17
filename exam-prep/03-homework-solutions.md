# Worked Solutions — Homework 1 and 2

> **All homework questions are inside the exam scope (weeks 1–5).** These are my own worked solutions, built from the lecture slides. Where a question is ambiguous I say which
> assumption I made. If HW2 isn't handed in yet, solve it yourself first and use this to check.

---

## Homework 1

### Q1. An application where soft robots beat hard robots
**Example answer: grasping delicate, irregular objects (fruit picking or food handling with a soft pneumatic gripper).**
- A rigid gripper needs exact object geometry and force control or it crushes the object. Each new object shape needs a redesigned end effector.
- A soft gripper (PneuNet fingers, Fin Ray fingers, a granular-jamming gripper) **conforms passively** to the shape, spreads the contact
  pressure, and its compliance caps the force. So one gripper handles many objects with simple open-loop control.
- It is also safe if it touches a human, light, and cheap.

Other good answers: **wearable rehabilitation gloves** (compliant and safe on the body), **minimally invasive surgery or endoscopy**
(a continuum body that doesn't damage tissue), **search and rescue in rubble** (deformable, squeezes through gaps),
**prosthetic hands**. Always state *advantage → why → over what limitation of rigid robots*.

### Q2. Robotic xylophone: soft vs rigid actuators
| Criterion | Rigid (motor or solenoid-driven mallet) | Soft (air muscles / hydrostatic transmission / rubbery fingers) |
|---|---|---|
| Strike | Stiff, position-controlled. The mallet must be pulled away quickly or it damps the bar and the tone sounds dead | Compliant and naturally **bouncy**: it hits and rebounds like a human wrist, so the bar rings freely |
| Dynamics / loudness | Loudness set by speed control; needs feedback | Loudness can be tuned through pressure or stiffness; elastic energy storage gives a fast "flick" (like the SSC) |
| Speed / repeatability | Very fast and repeatable (the glockenspiel robot plays "Popcorn") | Somewhat slower; pneumatic lag and hysteresis; harder to model and control |
| Safety / weight | Heavy motors (7–9× the density of muscle), unsafe if it hits a person | Light arm (actuators can sit remotely, e.g. Disney's hydrostatic arm), safe for human interaction |
| Expressiveness | Mechanical-sounding | More human-like motion and touch (Disney's air-muscle musicians, rubbery piano fingers) |
**Conclusion**: rigid actuators win on precision and speed. Soft actuators win on a natural, ringing strike, on safety, and on human-like expression,
because hitting a bar is a ballistic, impact task where compliance helps.

### Q3. Push-up: isometric vs isotonic concentric vs isotonic eccentric
- **Isometric**: holding the top (plank) or bottom position still. Pectoralis major, triceps and anterior deltoid develop tension but their
  **length doesn't change**, the joints don't move, and **no mechanical work** is done (energy is still used, "static work").
- **Isotonic concentric**: pushing up. The pecs and triceps **shorten** under roughly constant tension, the elbows extend, and the muscles do **positive work** against
  body weight.
- **Isotonic eccentric**: lowering down slowly. The same muscles stay tensed but **lengthen**, so the muscle does **negative work** and brakes the descent
  (controls the speed). An eccentric action can produce more force than an isometric one, because the elastic components help.
- Microscopically (sliding filament): concentric = actin slides inward and the Z lines move closer; eccentric = the filaments are pulled apart while the
  cross-bridges resist; isometric = the cross-bridges cycle but the filaments don't slide.

### Q4. Pennate tendon force
$$F_t = F_f\cos\alpha = 200\cos30° = \mathbf{173.2\ N}$$

### Q5. Robotic forearm with two linear elastic actuators
**Setup (from the figure):** the elbow pin C hangs from the rigid "upper arm" post. B and D are a distance b either side of C. Actuator BG is on the
weight side and DE is on the opposite side. At θ = 0 both actuators are vertical with length L, so G and E are at height L above
B and D. The tip weight mg is at horizontal distance L from C. Forearm and spring weights are neglected.

**(a) θ = 0 (elbow at 90°).** Take moments about the elbow C. The weight and F_DE both turn the forearm tip-down; F_BG turns it tip-up:
$$F_{BG}\,b = mg\,L + F_{DE}\,b\quad\Longrightarrow\quad \boxed{F_{BG}-F_{DE} = \frac{mgL}{b}}$$
- An antagonistic pair is **statically indeterminate**: one moment equation and two tensions. The co-contraction level (pre-tension) fixes the
  second unknown.
- **Minimum-effort answer** (antagonist DE relaxed or slack): $F_{DE}=0$, $\boxed{F_{BG} = mgL/b}$. With pre-tension T₀ added to both,
  $F_{BG} = T_0 + mgL/b$ and $F_{DE} = T_0$.
- Pin reaction at C (vertical balance): $R_C = mg - F_{BG} - F_{DE}$. A negative value means the pin pulls the forearm down.
- Note the class-3-lever penalty: since L ≫ b, the actuator force is many times the load, e.g. L = 5b gives 5 mg.

**(b) θ = 30° below horizontal (elbow at 120°).** Coordinates relative to C: $B' = (-b\cos30°, -b\sin30°)$, $D' = (b\cos30°, b\sin30°)$,
$G = (-b, L)$, $E = (b, L)$.

New actuator lengths (geometry):
$$\ell'_{BG} = \sqrt{b^2(1-\cos30°)^2 + (L+b\sin30°)^2} = \sqrt{0.018b^2 + (L+0.5b)^2}\approx L + \tfrac b2$$
$$\ell'_{DE} = \sqrt{b^2(1-\cos30°)^2 + (L-b\sin30°)^2} = \sqrt{0.018b^2 + (L-0.5b)^2}\approx L - \tfrac b2$$
So BG is stretched by about b/2 and DE is shortened by about b/2.

Hooke's law (tension change from the length change):
$$F'_{BG} = F_{BG} + k(\ell'_{BG}-L)\approx F_{BG} + \tfrac{kb}{2},\qquad F'_{DE} = \max\!\big[0,\;F_{DE} + k(\ell'_{DE}-L)\big]\approx F_{DE} - \tfrac{kb}{2}$$

Moment balance at 30° (exact; moment arm = r × unit force direction):
$$F'_{BG}\,\frac{b(L\cos30° + b\sin30°)}{\ell'_{BG}} = mgL\cos30° + F'_{DE}\,\frac{b(L\cos30° - b\sin30°)}{\ell'_{DE}}$$
If the actuators stay nearly vertical (L ≫ b), both moment arms become $b\cos30°$ and the weight's arm becomes $L\cos30°$. The cos 30° cancels:
$$F'_{BG}-F'_{DE}\approx \frac{mgL}{b}\quad(\text{the same difference as in (a)})$$

**Interpretation (worth writing on the exam):** purely passive springs would give $F'_{BG}-F'_{DE} = mgL/b + kb$, which is more than needed, so the
springs would push the arm back up toward θ = 0. To *hold* the weight at 30°, the actuators must actively lower their tension (reset their
rest length) by about kb in total. BG lengthens while under tension, so it works **eccentrically**, like the biceps lowering a weight. With the
antagonist slack, $F'_{BG}\approx mgL/b$. The exact geometry gives slightly less; for example, L = 5b gives $4.93\,mg$ instead of $5\,mg$.

> ⚠️ The question can be read in different ways (rest lengths aren't given). On an exam, **write your assumptions**, give the moment
> balance, the geometry of the new lengths, and the Hooke's-law change. That's where the marks are.

---

## Homework 2

### Q1. Squid tentacle: hydraulic leverage
Muscular hydrostat at **constant volume**: $V = \frac\pi4D^2L$, so
$$\frac{dL}{L} = -2\frac{dD}{D}\qquad\Longrightarrow\qquad \left|\frac{dL}{dD}\right| = \frac{2L}{D}$$
The displacement amplification (hydraulic leverage) is proportional to the **slenderness L/D**. Reading the constant-volume curve:
| Shape | L | D | Leverage 2L/D |
|---|---|---|---|
| A (short and fat) | ~1 | ~7 | ≈ 0.3 (a diameter change gives almost no elongation) |
| B | ~10 | ~2 | ≈ 10 |
| C | ~28 | ~1.3 | ≈ 43 |
| D (long and thin) | ~40 | ~1 | ≈ 80 |

**Answer: start from the long, slender shape (D, or at least C/D, not A).** On the flat tail of the curve, a tiny contraction of the transverse
and circular muscles (small ΔD) produces a large and rapid elongation of the stalk. So the length and speed of the strike are amplified, just as a
class-3 lever gives a distance and speed advantage. Starting from A, the same muscle shortening would barely lengthen the tentacle.

**Assumptions for hydraulic leverage to hold:**
1. The muscle tissue is **incompressible**, so the tentacle volume is constant (isovolumetric). There is no fluid cavity and no fluid exchange.
2. The tentacle stays a uniform cylinder: circular and transverse fibres reduce the diameter uniformly.
3. Longitudinal muscles are relaxed (they don't resist the elongation), and the connective tissue doesn't limit the length change.

### Q2. McKibben pneumatic artificial muscle
**Working principle:** an elastomer bladder sits inside a braided sleeve of **inextensible** fibres, clamped at both ends. Pressurizing pushes
the bladder outward. The fibres can't stretch, so the braid can only change shape by **changing its angle θ** (between the fibres and the long axis).
The diameter grows, and because each fibre has fixed length b, the length must shrink: $L = b\cos\theta$.
That converts pressure into axial pulling force, like a contracting muscle.

Geometry: $L = b\cos\theta$, $n\pi D = b\sin\theta$, so $V = \frac{b^3}{4\pi n^2}\sin^2\theta\cos\theta$.
Virtual work: $F\,(-dL) = P\,dV$, which gives
$$F = -P\frac{dV}{dL} = \frac{Pb^2}{4\pi n^2}\left(3\cos^2\theta - 1\right)$$
- F > 0 (contraction) when $3\cos^2\theta > 1$, i.e. **θ < 54.7°**.
- F = 0 and **maximum volume** at $\theta^* = \cos^{-1}(1/\sqrt3) = \mathbf{54.7°}$.
- θ > 54.7°: inflation **extends** the actuator.

**Critical angle: 54.7°.** As you pressurize, θ grows toward 54.7°, where contraction stops. The question says "above which", but measured from the long axis,
contraction happens for braid angles **below** 54.7°. If the angle is measured from the circumferential (hoop) direction, the same condition reads
**above 35.3°**. State your convention. The lecture's own wording is "less than 55° → shortens; greater than 55° → lengthens".

### Q3. Maximum walking speed and power (m = 60 kg, L = 0.9 m)
**Max speed** (the foot stays on the ground while gravity supplies the centripetal force):
$$v_{\max} = \sqrt{gL} = \sqrt{9.81\times0.9} = \mathbf{2.97\ m/s}$$

**Power.** The lecture gives versions of the walking-power formula that differ by constant factors. Use the one your lecturer boxed, and show the formula:

| Model | Formula | Result at v = 2.97 m/s |
|---|---|---|
| **Lecture boxed formula** (slide 20) | $P_W = mgL\frac\pi2\sqrt{\frac{3L}{2g}}\left(\frac vL\right)^2$ | **≈ 3.36 kW** |
| Sprott impulse model, T = 2π√(3L/2g) = 2.33 s | $P_W = \frac{mg}{4}\frac{v^2}{L}\frac T4$ | ≈ 0.84 kW |
| Same, with the true compound-pendulum T = 2π√(2L/3g) = 1.55 s | same | ≈ 0.56 kW |

Working for the boxed formula: $mgL = 60(9.81)(0.9) = 529.7$ J; $\sqrt{3L/2g} = \sqrt{2.7/19.62} = 0.371$ s; $(v/L)^2 = g/L = 10.9$ s⁻²;
$P = 529.7\times1.571\times0.371\times10.9 \approx 3.36\times10^3$ W.

> Why they differ: the boxed derivation uses $\Delta h = L(1-\cos\Theta)$ with Θ the *whole* step angle. If Θ is the whole step, the hip only rises by
> $L(1-\cos\tfrac\Theta2)$, which is 4× smaller and brings you back to the Sprott value. Also, the slide text says T = 2π√(2L/3g) but the equation
> shows 2π√(3L/2g). A one-line remark like this on the exam shows understanding.

### Q4. Usain Bolt: propulsive force by the energy method
Data: $m_b = 94$ kg; legs = 16 % of body mass, so **$m_\text{leg} = 7.52$ kg each**; step length L = 2.44 m; step frequency 4.23 Hz.
(The "stride" figures are really *step* figures: 2.44 × 4.23 = 10.3 m/s ≈ 100/9.58 = 10.4 m/s. The table's first column is distance x in m, not time.)

**Model (lecture "sprint" slides).** In each step the propulsive force does work FL, which (i) changes the KE of the upper body plus swing leg,
$(m_b-2m_\text{leg})$, and (ii) accelerates the newly lifted leg from rest:
$$FL = \tfrac12(m_b-2m_\text{leg})(v_n^2-v_{n-1}^2) + \tfrac12m_\text{leg}v_n^2$$
Over a 10 m interval there are n = 10/2.44 = 4.1 steps, so
$$F\,\Delta x \approx \tfrac12(78.96)(v_b^2-v_a^2) + 4.1\times\tfrac12(7.52)\,\overline{v^2},\qquad \overline{v^2} = \tfrac12(v_a^2+v_b^2)$$

| x (m) | ΔKE body (J) | Leg re-acceleration (J) | Work (J) | **F (N)** |
|---|---|---|---|---|
| 0–10 | 1459 | 285 | 1744 | 174 |
| 10–20 | 2202 | 999 | 3201 | **320 (max)** |
| 20–30 | 1335 | 1690 | 3025 | 303 |
| 30–40 | 774 | 2101 | 2875 | 288 |
| 40–50 | 154 | 2282 | 2436 | 244 |
| 50–60 | 29 | 2318 | 2347 | 235 |
| 60–70 | −39 | 2316 | 2278 | 228 |
| 70–80 | −163 | 2277 | 2114 | 211 |
| 80–90 | −152 | 2215 | 2064 | 206 |
| 90–100 | −370 | 2114 | 1744 | 174 |
| **Total** | | | **23 828 J** | |

- **Average propulsive force** ≈ 23 828 J / 100 m ≈ **240 N** (≈ 0.26 body weight).
- **Maximum** ≈ **320 N** in the 10–20 m acceleration phase.
- Check at top speed: when v is steady, all work goes into the legs: $F = \frac{m_\text{leg}v^2}{2L} = \frac{7.52\times12.28^2}{2\times2.44} = 232$ N,
  which matches the 50–70 m rows.
- Quick estimate: using the average speed 10.32 m/s in the same formula gives 164 N.
- Caveat: the 0–10 m value is underestimated, because early steps are much shorter than 2.44 m and block clearance needs large forces.
- "Impulsive": this work is actually delivered only while the foot is on the ground. If contact is a fraction β of each step, the force *during contact* is
  about F/β (for example β ≈ 0.4 gives about 2.5× larger). The horizontal impulse per step is F × (1/4.23 s) ≈ 240 × 0.236 ≈ 57 N·s.
