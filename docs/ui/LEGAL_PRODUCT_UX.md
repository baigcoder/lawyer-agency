# Wakeel — Legal Product UX & Professional Ethics

**Status:** IMPLEMENTED BASELINE & ETHICS MANDATE  
**Classification:** Legal Industry UX Philosophy, Professional Decorum, and Compliance  
**Jurisdiction:** Pakistan Legal Practitioners and Bar Councils Rules 1976  

---

## 1. The Dignity of Legal Practice

In Pakistan, advocates are officers of the court (*Amicus Curiae* / court officers). The legal profession is steeped in tradition, dignity, and solemn responsibility:
- **No Consumer Trivialization:** Wakeel is never designed like an e-commerce store or a casual customer support tool. Words like *"buy"*, *"cart"*, *"deal"*, or *"discount"* are strictly banned from UI copy.
- **Respectful Terminology:** Interfaces use dignified Pakistani legal terms: *Matters* (کیسز), *Vakalatnama* (وکالت نامہ), *Advocate Consultation* (مشاورت), *Retainer Fee* (فیس وکالت), *Court Diary* (پيشي فہرست).
- **Solemnity in Crisis:** When a client reports domestic violence or wrongful detention, the interface shifts to an emergency crisis state with immediate helpline resources and urgent notification to the partner.

---

## 2. Avoiding the "Cheap Chatbot" Trap

Most legal chatbots fail because they attempt to replace the lawyer, generating flawed, generic legal advice that exposes the firm to malpractice liability.

### How Wakeel Avoids the Trap
1. **Intake, Not Advice:** Wakeel collects facts; it does not render legal judgment.
2. **First-Turn Disclosure:** The assistant never pretends to be a human lawyer. It honestly identifies itself as the firm's automated receptionist.
3. **Firm Identity Preservation:** The AI speaks in the name of the law firm (`"Advocate Malik Rashid's Office"`), upholding the reputation and prestige of the practice.
4. **Lawyer Handoff Brief:** The culmination of automated intake is a crisp, structured brief presented to the advocate, enabling the lawyer to walk into the consultation fully prepared.

---

## 3. Confidentiality & Privileged Communications

Under Section 126 of the **Qanun-e-Shahadat Order 1984** (Law of Evidence in Pakistan), communications between an advocate and client are strictly privileged:
- **Zero Third-Party Leakage:** Client court records, identity cards (CNICs), and voice note audio files are Tier 3 data and are **never** passed to external public LLMs for inference.
- **Role-Based Redaction:** Junior staff and clerks cannot access privileged document files unless explicitly authorized on the matter.
- **Complete Audit Trail:** Every message view, document download, and status change is logged in `app.audit_logs` with actor ID, timestamp, and IP address.
