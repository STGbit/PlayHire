import Link from "next/link";
import { ArrowRight, Goal, MapPin, ShieldCheck, Users } from "lucide-react";

const players = [
  { number: "1", className: "keeper" },
  { number: "2", className: "defender-one" },
  { number: "4", className: "defender-two" },
  { number: "6", className: "midfielder-one" },
  { number: "8", className: "midfielder-two" },
  { number: "10", className: "midfielder-three" },
  { number: "9", className: "forward-one" },
  { number: "11", className: "forward-two" },
];

export default function Landing() {
  return (
    <main className="site-refresh">
      <header className="refresh-header">
        <Link className="refresh-brand" href="/">
          <span className="refresh-mark"><Goal size={20} /></span>
          <span>playhire<i>.</i></span>
        </Link>
        <div className="refresh-nav-links">
          <a className="readiness-badge refresh-nav-link" href="#readiness">Readiness engine</a>
          <a className="about-anchor-link refresh-nav-link" href="#about-playhire">About PlayHire</a>
        </div>
        <div className="refresh-actions">
          <Link href="/login?mode=login" className="refresh-signin">Sign in</Link>
          <Link href="/login?mode=signup" className="refresh-cta">Create your account</Link>
        </div>
      </header>

      <section className="refresh-hero" id="top">
        <div className="hero-copy-v2">
          <h1>One player out.<br /><em>A plan already in.</em></h1>
          <p className="hero-lede">Last minute absences happen. PlayHire helps captains find available, eligible cover for the match in front of them, with the fit explained in plain language.</p>
          <div className="hero-actions-v2">
            <Link className="button-solid-v2" href="/login?mode=signup">Get started <ArrowRight size={16} /></Link>
          </div>
        </div>

        <div className="hero-visual">
          <section className="tactical-module" aria-label="Example tactical lineup">
            <div className="tactical-head">
              <div>
                <span className="tactical-kicker">MATCHDAY 08 <i>·</i> EXAMPLE</span>
                <h2>Eastside FC <span>vs</span> North City</h2>
              </div>
              <span className="tactical-time">SAT · 4:30 PM</span>
            </div>
            <div className="tactical-pitch">
              <div className="pitch-halfway" />
              <div className="pitch-center-circle" />
              <div className="pitch-box pitch-box-left" />
              <div className="pitch-box pitch-box-right" />
              {players.map(player => <span key={player.number} className={`player-node ${player.className}`}>{player.number}</span>)}
              <span className="player-node player-node-open">+</span>
            </div>
            <div className="tactical-meta">
              <span><i className="availability-dot" /> 8 confirmed</span>
              <span className="position-needed">Midfielder needed</span>
            </div>
          </section>

          <div className="tactical-status-row">
            <article className="status-card replacement-card">
              <div className="status-icon"><ShieldCheck size={17} /></div>
              <div className="status-copy"><strong>Replacement found</strong><span>Midfielder · <MapPin size={12} /> 2.4 km away</span></div>
              <span className="fit-pill"><b>84</b> FIT</span>
            </article>
            <article className="status-card bench-card-v3">
              <div className="bench-icon"><Users size={17} /></div>
              <div className="status-copy"><strong>Backup bench</strong><span>6 available players</span></div>
              <i className="availability-dot" />
            </article>
          </div>
        </div>
      </section>

      <section className="readiness-v2" id="readiness">
        <div className="readiness-copy">
          <h2>A useful score<br /><em>shows its working.</em></h2>
          <p>PlayHire filters first, then ranks eligible players. The score is deterministic, the criteria are visible, and confidence reflects how complete the player data is.</p>
        </div>
        <div className="weights-card">
          <div className="weights-top"><div><span>SUITABILITY WEIGHTS</span><strong>What goes into the fit</strong></div><span className="method-pill">RULE BASED</span></div>
          <Weight label="Position compatibility" value={30} />
          <Weight label="Skill compatibility" value={25} />
          <Weight label="Reliability evidence" value={20} />
          <Weight label="Distance suitability" value={15} />
          <Weight label="Budget suitability" value={10} />
        </div>
      </section>

      <section className="about-v2 about-complete" id="about-playhire">
        <div className="about-overview">
          <div className="about-heading"><div className="eyebrow-v2"><span /> ABOUT PLAYHIRE</div><h2>Built for Lineup Changes<br />&amp; Talent Intelligence</h2><p className="about-subtitle">A clearer way to find match day cover.</p></div>
          <p>PlayHire is a football roster continuity MVP focused on a familiar problem: a player drops out close to match day and the captain needs suitable cover quickly. Captains can manage teams, roster entries, and fixtures; players can join with a team code and maintain their playing profile. The scouting assistant uses AI to turn a captain’s plain language request into editable search filters, then a transparent rule based engine filters and ranks candidate profiles. The current candidate pool is illustrative; performance benchmarking and long term talent passports are future work.</p>
        </div>
        <div className="about-workflow">
          <div className="about-workflow-heading"><span className="eyebrow-v2">HOW PLAYHIRE WORKS</span><h3>Four steps from roster gap to shortlist</h3></div>
          <ol className="workflow-grid">
            <li><span className="workflow-index">01</span><h4>Capture</h4><p>Set up teams, roster entries, player profiles, and match details in one workspace.</p></li>
            <li><span className="workflow-index">02</span><h4>Interpret</h4><p>Describe the replacement need in everyday language. AI extracts position, skill, budget, distance, or player name filters.</p></li>
            <li><span className="workflow-index">03</span><h4>Filter</h4><p>Apply the filters to available, eligible candidate records. The captain can review and edit every criterion.</p></li>
            <li><span className="workflow-index">04</span><h4>Compare</h4><p>A fixed readiness formula ranks the matching profiles and shows the factors behind each score. The captain makes the final choice.</p></li>
          </ol>
        </div>
        <div className="about-creator"><div><span className="eyebrow-v2">ABOUT THE CREATOR</span><h3>Built by Subham Chandra</h3></div><p>Created by Subham Chandra, a Computer Science and Engineering student at the Institute of Engineering &amp; Management (IEM), Kolkata. Subham focuses on web development, intelligent software, and practical engineering solutions. PlayHire explores how AI assisted search and transparent scoring can help football captains respond to last minute absences while keeping the final decision in human hands.</p></div>
      </section>

      <footer className="refresh-footer">
        <Link className="refresh-brand" href="/"><span className="refresh-mark"><Goal size={17} /></span><span>playhire<i>.</i></span></Link>
        <span>Keep your team ready for the match ahead.</span>
      </footer>
    </main>
  );
}

function Weight({ label, value }: { label: string; value: number }) {
  return <div className="weight-row"><span>{label}</span><div><i style={{ width: `${value * 3}%` }} /></div><b>{value}%</b></div>;
}
