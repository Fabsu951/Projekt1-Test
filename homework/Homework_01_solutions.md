# ENNV 30028 Management of Contaminated Land and Groundwater — Homework #1

**Due:** 19 October 2026 (in class)

Throughout, the relationships used are those from the lecture *Three-phase Relationship of Soil*:

| Quantity | Definition |
|---|---|
| Water content | $w = \dfrac{M_w}{M_s} = \dfrac{W_w}{W_s}$ |
| Void ratio | $e = \dfrac{V_v}{V_s}$ |
| Porosity | $n = \dfrac{V_v}{V_t} = \dfrac{e}{1+e}$ |
| Degree of saturation | $S = \dfrac{V_w}{V_v}$ |
| Specific gravity of solids | $G_s = \dfrac{\rho_s}{\rho_w}$ |
| Bulk density / unit weight | $\rho = \dfrac{M_t}{V_t}, \quad \gamma = \dfrac{W_t}{V_t}$ |
| Dry density / unit weight | $\rho_{dry} = \dfrac{M_s}{V_t}, \quad \gamma_{dry} = \dfrac{W_s}{V_t}$ |
| Useful relations | $\rho = \rho_{dry}(1+w), \quad \rho_{dry} = \dfrac{\rho_s}{1+e}, \quad G_s w = S e$ |

Unit weight of water: $\gamma_w = 9.81\ \text{kN/m}^3$; density of water $\rho_w = 1\ \text{g/cm}^3$.

---

## Question 1

**Given:** saturated soil ($S = 1$), $w = 27\% = 0.27$, $\gamma = \gamma_{sat} = 19.7\ \text{kN/m}^3$.

### Dry unit weight

From $\rho = \rho_{dry}(1+w)$, multiplying both sides by $g$ gives $\gamma = \gamma_{dry}(1+w)$:

$$
\gamma_{dry} = \frac{\gamma}{1+w} = \frac{19.7}{1.27} = \mathbf{15.51\ kN/m^3}
$$

### Specific gravity $G_s$ and void ratio $e$

Take a three-phase diagram with $V_s = 1$, so $V_v = e$ and $V_t = 1 + e$.

- Weight of solids: $W_s = G_s \gamma_w V_s = G_s \gamma_w$
- Saturated, so $V_w = V_v = e$ and $W_w = e\,\gamma_w$

$$
\gamma_{sat} = \frac{W_s + W_w}{V_t} = \frac{(G_s + e)\,\gamma_w}{1+e}
$$

For a saturated soil, $G_s w = S e$ with $S = 1$ gives $e = w G_s = 0.27\,G_s$. Substituting:

$$
19.7 = \frac{(G_s + 0.27 G_s)(9.81)}{1 + 0.27 G_s} = \frac{12.459\,G_s}{1 + 0.27 G_s}
$$

$$
19.7 + 5.319\,G_s = 12.459\,G_s \;\Rightarrow\; G_s = \frac{19.7}{7.140} = \mathbf{2.76}
$$

$$
e = w G_s = 0.27 \times 2.759 = \mathbf{0.745}
$$

**Check:** $\gamma_{dry} = \dfrac{G_s \gamma_w}{1+e} = \dfrac{2.759 \times 9.81}{1.745} = 15.51\ \text{kN/m}^3$ ✓

### Total unit weight at $S = 85\%$ (same $e$)

With $V_s = 1$: $V_w = S e$, so $W_w = S e\,\gamma_w$:

$$
\gamma = \frac{(G_s + S e)\,\gamma_w}{1+e} = \frac{(2.759 + 0.85 \times 0.745)(9.81)}{1.745} = \frac{(3.392)(9.81)}{1.745} = \mathbf{19.07\ kN/m^3}
$$

(The water content at this state would be $w = Se/G_s = 0.85 \times 0.745 / 2.759 = 23.0\%$.)

### Answers

| | Value |
|---|---|
| $\gamma_{dry}$ | **15.5 kN/m³** |
| $e$ | **0.745** |
| $G_s$ | **2.76** |
| $\gamma$ at $S = 85\%$ | **19.1 kN/m³** |

---

## Question 2

**Given:** cylinder $D = 38\ \text{mm}$, $L = 76\ \text{mm}$; $M_t = 168.0\ \text{g}$; $M_s = 130.5\ \text{g}$; $G_s = 2.7$.

The method follows the worked example in the lecture (the 50 cm³ sample).

**Total volume**

$$
V_t = \frac{\pi D^2}{4} L = \frac{\pi (3.8\ \text{cm})^2}{4}(7.6\ \text{cm}) = 86.19\ \text{cm}^3
$$

**Mass of water**

$$
M_w = M_t - M_s = 168.0 - 130.5 = 37.5\ \text{g}
\qquad \left(w = \tfrac{37.5}{130.5} = 28.7\%\right)
$$

**Volume of solids** ($\rho_s = G_s \rho_w = 2.7\ \text{g/cm}^3$)

$$
V_s = \frac{M_s}{\rho_s} = \frac{130.5}{2.7} = 48.33\ \text{cm}^3
$$

**Volume of voids**

$$
V_v = V_t - V_s = 86.19 - 48.33 = 37.86\ \text{cm}^3
$$

**Void ratio**

$$
e = \frac{V_v}{V_s} = \frac{37.86}{48.33} = \mathbf{0.783}
$$

**Degree of saturation** ($V_w = M_w/\rho_w = 37.5\ \text{cm}^3$)

$$
S = \frac{V_w}{V_v} = \frac{37.5}{37.86} = \mathbf{99.0\%}
$$

**Check with $G_s w = S e$:** $S = \dfrac{G_s w}{e} = \dfrac{2.7 \times 0.2874}{0.783} = 0.990$ ✓

### Three-phase diagram (masses in g, volumes in cm³)

| Phase | Mass | Volume |
|---|---|---|
| Air | ≈ 0 | $V_a = 0.36$ |
| Water | $M_w = 37.5$ | $V_w = 37.5$ |
| Solid | $M_s = 130.5$ | $V_s = 48.33$ |
| **Total** | $M_t = 168.0$ | $V_t = 86.19$ ($V_v = 37.86$) |

### Answers

| | Value |
|---|---|
| $e$ | **0.78** |
| $S$ | **99%** (nearly saturated) |

---

## Question 3

**Derive** $\rho$ for a partially saturated soil in terms of $G_s$, $e$, $S$ and $\rho_w$.

Use the three-phase diagram and set $V_s = 1$ (as in the lecture's derivation of $\rho_{dry} = \rho_s/(1+e)$).

**Volumes**

- $V_s = 1$
- $V_v = e\,V_s = e$ (definition of $e$)
- $V_w = S\,V_v = S e$ (definition of $S$)
- $V_t = V_s + V_v = 1 + e$

**Masses**

- $M_s = \rho_s V_s = G_s \rho_w$ (since $G_s = \rho_s/\rho_w$)
- $M_w = \rho_w V_w = S e\,\rho_w$
- $M_a \approx 0$
- $M_t = M_s + M_w = G_s \rho_w + S e\,\rho_w$

**Bulk density**

$$
\rho = \frac{M_t}{V_t} = \frac{G_s \rho_w + S e\,\rho_w}{1+e}
$$

$$
\boxed{\rho = \frac{(G_s + S e)\,\rho_w}{1+e}}
$$

**Limiting cases (checks):**

- Dry soil, $S = 0$: $\rho = \dfrac{G_s \rho_w}{1+e} = \rho_{dry}$, which matches the lecture's $\rho_{dry} = \rho_s/(1+e)$.
- Saturated soil, $S = 1$: $\rho = \dfrac{(G_s + e)\rho_w}{1+e} = \rho_{sat}$.

**Equivalent form:** substituting $S e = G_s w$ gives $\rho = \dfrac{G_s(1+w)\rho_w}{1+e} = \rho_{dry}(1+w)$, consistent with the lecture.

---

## Question 4 — Case history: RCA Taoyuan plant, Taiwan

### (a) The incident

- **What the site was:** Radio Corporation of America (RCA) ran a large electronics plant in Taoyuan from 1970 to 1992, making televisions and electronic components.
- **What was used:** manufacturing and degreasing used large quantities of chlorinated organic solvents, mainly trichloroethylene (TCE) and tetrachloroethylene (PCE, perchloroethylene), with others such as 1,1,1-trichloroethane.
- **What was dumped:** for years, waste solvents and wastewater were dumped on the ground and poured into a well on the site instead of being treated.
- **Change of ownership:** RCA was taken over by GE in 1986 and the consumer-electronics business passed to Thomson in 1988. The plant closed in 1992 and the land was sold, reportedly without the contamination being disclosed.
- **Discovery:** in 1994 a whistleblower made the dumping public. The Taiwan Environmental Protection Administration (EPA) then investigated and confirmed that the soil and groundwater under the site were heavily contaminated with chlorinated volatile organic compounds (VOCs): TCE, PCE and others.

### (b) Impacts on the residents, the ecology and the environment

**Residents and workers**

- Workers used the groundwater for drinking and cooking in the plant, and were also exposed to the solvents directly at work.
- Former workers reported high rates of cancer, including liver, lung, breast and lymphatic cancers, and other serious illness. Plaintiffs in the lawsuit alleged hundreds of cancer cases and many deaths among former employees.
- Groundwater was also drawn from wells around the site. Contamination was reported in groundwater up to about 2 km away, so nearby residents faced exposure through drinking water.

**Soil and groundwater**

- TCE and PCE are dense non-aqueous phase liquids (DNAPLs): denser than water and only slightly soluble. They sink through the aquifer and stay as a long-lasting residual source. This makes the contamination very persistent and hard to remove.
- The contaminant plume moved off-site with the groundwater flow, mainly to the north and northwest of the plant.
- Natural biodegradation of TCE and PCE produces vinyl chloride, which is even more toxic, and later monitoring found it above standards in many wells.
- The aquifer became unusable as a drinking-water source, and the land lost value for redevelopment.

**Ecology**

- The solvents are toxic to soil organisms and aquatic life, and polluted groundwater can discharge into surface water and irrigation channels.
- The main documented damage, however, is to the groundwater resource and to human health.

### (c) The consequence

- **Regulation:** the case became a turning point in Taiwan's environmental regulation. It is widely cited as a driver for the **Soil and Groundwater Pollution Remediation Act (2000)**. Like the U.S. CERCLA/Superfund law discussed in the lecture, the Act makes polluters (and in some cases landowners) liable for investigating and cleaning up contaminated sites.
- **Lawsuit:** in 2004 the RCA Employees' Self-Help Association filed a landmark class lawsuit against RCA, its parent companies (GE, Thomson/Technicolor) and the successor companies. It was one of the longest occupational-pollution lawsuits in Taiwan's history.
  - **2015:** the Taipei District Court ordered compensation of about NT$564 million to 445 plaintiffs.
  - **2017:** the Taiwan High Court raised the award to about NT$718 million.
  - **2018:** the Supreme Court upheld the companies' liability and the causal link between the toxic exposure and the workers' illnesses. It confirmed the awards for 262 plaintiffs and sent the remaining claims back for retrial.
  - **2019:** in a second group lawsuit, the Taipei District Court ordered about NT$2.3 billion for about 1,120 former workers and family members.
  - **2025:** further High Court rulings followed in January 2025.
- **Precedent:** the case set important precedents for corporate liability for occupational and environmental exposure, for parent-company liability, and for how courts accept epidemiological evidence of causation.
- **Lasting contamination:** because of the DNAPL source, the site has needed decades of monitoring and treatment. It is still under environmental supervision and has not been taken off the pollution-control list.

### (d) Remedial actions taken by the relevant parties

**Taiwan EPA and the Taoyuan local government**

- Investigated and confirmed the contamination, and listed the site under soil and groundwater pollution control.
- Required the responsible companies to submit and carry out remediation plans.
- Advised that local groundwater not be used for drinking.
- Set up long-term groundwater monitoring wells around the site.

**RCA, GE and Thomson (responsible parties)**

- Carried out site investigation and groundwater clean-up between about 1996 and 1998, mainly **pump-and-treat**: extracting contaminated groundwater and treating it above ground (for example by air stripping or activated carbon) to remove VOCs.
- The companies later argued that the contamination could not be fully reversed. This reflects the known limits of pump-and-treat for DNAPL sources: residual solvent keeps dissolving into the groundwater for many years.

**Researchers**

- Universities in Taiwan, including NCTU, studied alternatives such as a **funnel-and-gate permeable reactive barrier with zero-valent iron**, which breaks down TCE and PCE as groundwater flows through it.
- Modelling suggested it could remove dissolved chlorinated solvents more effectively than pump-and-treat.

**Overall:** the clean-up cost hundreds of millions and has lasted more than 20 years. The site shows why the ESA steps in the lecture matter:

- a desk study of past industrial processes,
- a walk-over inspection,
- a sampling and analysis programme using monitoring wells, groundwater sampling and in-situ measurements,
- interpretation of the data to locate contaminant "hot spots".

These should be done before land changes hands, so that the liability and the risk to people are known early.

### References

- AFP / Phys.org (2015). "Taiwan factory workers win $18 mn over cancer deaths." <https://phys.org/news/2015-04-taiwan-factory-workers-mn-cancer.html>
- Environment News Service (2015). "RCA Taiwan Ex-Workers Win Pollution Lawsuit." <https://ens-newswire.com/rca-taiwan-ex-workers-win-pollution-lawsuit/>
- Taipei Times (2019-12-28). "Court orders RCA to pay NT$2.3bn." <https://www.taipeitimes.com/News/taiwan/archives/2019/12/28/2003728314>
- Taipei Times (2020-03-07). "High Court orders RCA to pay 24 of 246 plaintiffs." <https://www.taipeitimes.com/News/taiwan/archives/2020/03/07/2003732233>
- Taipei Times (2025-01-17). "Court finds RCA liable for illnesses." <https://www.taipeitimes.com/News/taiwan/archives/2025/01/17/2003830382>
- Business & Human Rights Resource Centre. "Workplace exposure to toxic chemicals lawsuit (re Taiwan)." <https://www.business-humanrights.org/en/latest-news/workplace-exposure-to-toxic-chemicals-lawsuit-re-taiwan/>
- Equal Times. "The decades-long legal struggle of Taiwanese electronics workers." <https://www.equaltimes.org/the-decades-long-legal-struggle-of?lang=en>
- East Asian Science, Technology and Society (2023). "Field Report: Taiwan's RCA Litigation and Its Multiple Outreaches." <https://www.tandfonline.com/doi/full/10.1080/18752160.2023.2269019>
- NCTU thesis on funnel-and-gate remediation of the RCA site. <https://ir.lib.nycu.edu.tw/handle/11536/66209>
- NTU thesis on RCA Taoyuan groundwater contamination. <https://tdr.lib.ntu.edu.tw/handle/123456789/54879>
