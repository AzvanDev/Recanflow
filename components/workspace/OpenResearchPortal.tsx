import { useEffect, useState, type ChangeEvent } from "react";
import { ExternalLink, FileText, Plus, Search, Upload, X } from "lucide-react";
import type { PaperResult, ResearchItem } from "@/lib/types";
import { newId } from "@/lib/workspace";
import { searchResearchPapers, uploadResearchDocument } from "@/lib/research-client";

export type OpenResearchPortalProps = {
  defaultQuery: string;
  onClose: () => void;
  onAdd: (item: ResearchItem) => void;
};

function paperToItem(paper: PaperResult): ResearchItem {
  return {
    id: paper.id,
    title: paper.title,
    institution: paper.institution,
    year: paper.year,
    sourceType: paper.sourceType,
    url: paper.openAccessUrl || paper.url,
  };
}

// A research result is a plain link, not a briefing: title, institution/publisher, year, and
// two actions. No abstract, no AI text, nothing generated — everything shown here comes
// straight from the search provider's own response.
function ResultRow({ item, onAdd }: { item: ResearchItem; onAdd: () => void }) {
  const meta = [item.institution, item.year, item.sourceType].filter(Boolean).join(" · ");
  return (
    <div className="research-result-card">
      <span className="research-result-title">{item.title}</span>
      {meta && <p className="research-result-meta">{meta}</p>}
      <div className="research-result-actions">
        {item.url && (
          <a className="node-action" href={item.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={12} /> Open
          </a>
        )}
        <button className="node-action" onClick={onAdd}>
          <Plus size={12} /> Add to Flow
        </button>
      </div>
    </div>
  );
}

export function OpenResearchPortal({ defaultQuery, onClose, onAdd }: OpenResearchPortalProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<PaperResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedItems, setUploadedItems] = useState<ResearchItem[]>([]);

  async function runSearch(q: string) {
    if (!q.trim() || searching) return;
    setSearching(true);
    try {
      const papers = await searchResearchPapers(q.trim());
      setResults(papers);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  // Starts from the current branch's topic automatically — the user can still edit and re-search.
  useEffect(() => {
    if (defaultQuery.trim()) runSearch(defaultQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uploads are identified (name + type), never analyzed or summarized here — that's
  // deliberately out of scope for this finder. Deeper document understanding is a separate
  // feature to build later.
  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const { fileName } = await uploadResearchDocument(file);
      const ext = fileName.toLowerCase().split(".").pop();
      const docType = ext === "pdf" ? "PDF document" : ext === "docx" ? "Word document" : "Text document";
      setUploadedItems((prev) => [...prev, { id: newId("item"), title: fileName, sourceType: docType, uploaded: true }]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not process this file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="ai-panel open-research floating">
      <div className="panel-header">
        <div>
          <span className="eyebrow">OPEN RESEARCH</span>
          <h2>Open Research</h2>
        </div>
        <button aria-label="Close Open Research" title="Close Open Research" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div className="panel-toolbar">
        <p>What do you want to research?</p>
        <div className="open-research-search">
          <input
            aria-label="Search research papers and documents"
            placeholder="Search for papers, reports, documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") runSearch(query);
            }}
          />
          <button aria-label="Search" onClick={() => runSearch(query)} disabled={searching || !query.trim()}>
            <Search size={14} /> Search
          </button>
        </div>
        <label className="node-action open-research-upload">
          <input type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={handleFileChange} />
          <Upload size={13} /> Upload document
        </label>
        {uploading && (
          <p className="thinking">
            <span /> Reading document…
          </p>
        )}
        {uploadError && <p className="node-error">{uploadError}</p>}
      </div>
      <div className="panel-body">
        {uploadedItems.length > 0 && (
          <>
            <span className="eyebrow">UPLOADED</span>
            <div className="research-results">
              {uploadedItems.map((item) => (
                <div key={item.id} className="research-result-card">
                  <span className="research-result-title">
                    <FileText size={13} /> {item.title}
                  </span>
                  <p className="research-result-meta">{item.sourceType}</p>
                  <div className="research-result-actions">
                    <button className="node-action" onClick={() => onAdd(item)}>
                      <Plus size={12} /> Add to Flow
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <span className="eyebrow">RESEARCH RESULTS</span>
        {searching && (
          <p className="thinking">
            <span /> Searching research…
          </p>
        )}
        {!searching && searched && results.length === 0 && <p className="chat-empty">No research results found. Try a different search.</p>}
        <div className="research-results">
          {results.map((paper) => (
            <ResultRow key={paper.id} item={paperToItem(paper)} onAdd={() => onAdd(paperToItem(paper))} />
          ))}
        </div>
      </div>
    </section>
  );
}
