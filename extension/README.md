# JobCopilot AI — Chrome Extension (Client-Side Apply)

The high-scale client-side application copilot for **1,000+ concurrent users**.

## Why this Architecture?
- **Zero Server Browser Overhead**: 1,000+ users run form filling inside their own personal browsers simultaneously. No server RAM explosion or browser crashes.
- **Always Authenticated**: Runs directly inside the user's active browser where they are already logged in to LinkedIn, Google, and Workday with their active 2FA and cookies.
- **Zero Bot/IP Bans**: Requests originate from individual residential IP connections, bypassing datacenter IP blocking on LinkedIn.
- **Unified Master Excel Tracker**: Every applied job from any portal logs into a single master sheet with 1-click CSV/Excel download.
- **Rate-Limited & Quota Protected**: Includes a daily free allowance meter (20 applies/day) and recharge/subscription options.

---

## 🚀 How to Install (Takes 30 Seconds)

1. Open Google Chrome (or Edge / Brave).
2. Navigate to: `chrome://extensions` (or `edge://extensions`).
3. Turn **ON** the **Developer mode** toggle in the top-right corner.
4. Click **"Load unpacked"** in the top-left corner.
5. Select this `extension/` folder.
6. Pin the **JobCopilot AI** (⚡) icon to your browser toolbar!

---

## 🎯 How to Use

1. **Start the AI Backend Engine**:
   ```bash
   npm start
   ```
   *(Running at `http://127.0.0.1:3000` or your cloud hosted URL)*

2. **Navigate to any job application page**:
   - LinkedIn (`linkedin.com/jobs/view/...`)
   - Greenhouse (`boards.greenhouse.io/...`)
   - Lever (`jobs.lever.co/...`)
   - Workday (`myworkdayjobs.com/...`)
   - Ashby (`ashbyhq.com/...`)
   - SmartRecruiters, Workable, Indeed, Naukri, or direct company career pages.

3. **1-Click Auto-Apply**:
   - You will see a sleek floating badge: **`⚡ AI Auto-Apply`**.
   - Click **`1-Click Apply`** (or open the extension popup and click **`⚡ Auto-Fill This Job Tab`**).
   - The Copilot:
     1. Extracts the job description and sends it to the backend.
     2. Generates an ATS single-column Resume PDF tailored specifically to this job.
     3. Attaches the tailored PDF directly to the application file upload input.
     4. Reasons over screening questions (experience, notice period, work authorization) and fills all inputs.
     5. Highlights filled fields in **emerald green** for your quick review.
     6. Syncs the application to your unified Excel tracker sheet.
   - Review the pre-filled form and click Submit!

4. **1-Click Excel Tracker Download**:
   - Open the popup anytime and click **"📥 Download Applications (Excel / CSV)"** to get your complete application history.
