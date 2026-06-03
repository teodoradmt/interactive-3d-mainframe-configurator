import { HelpCircle, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchGlossaryTerms } from '../services/mainframeApi.js';

function normalizeSearchValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function GlossaryMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [glossaryTerms, setGlossaryTerms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const requestIdRef = useRef(0);
  const normalizedQuery = normalizeSearchValue(query);
  const filteredTerms = useMemo(() => {
    if (!normalizedQuery) {
      return glossaryTerms;
    }

    return glossaryTerms.filter((item) => (
      normalizeSearchValue(item.term).includes(normalizedQuery)
      || normalizeSearchValue(item.category).includes(normalizedQuery)
      || normalizeSearchValue(item.definition).includes(normalizedQuery)
    ));
  }, [glossaryTerms, normalizedQuery]);

  const loadGlossaryTerms = useCallback(async () => {
    const requestId = requestIdRef.current + 1;

    requestIdRef.current = requestId;
    setIsLoading(true);

    try {
      const terms = await fetchGlossaryTerms();

      if (requestIdRef.current === requestId) {
        setGlossaryTerms(Array.isArray(terms) ? terms : []);
        setError('');
      }
    } catch {
      if (requestIdRef.current === requestId) {
        setGlossaryTerms([]);
        setError('Terms are unavailable.');
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadGlossaryTerms();
  }, [loadGlossaryTerms]);

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  useEffect(() => {
    if (isOpen && error) {
      loadGlossaryTerms();
    }
  }, [error, isOpen, loadGlossaryTerms]);

  const closeOnBlur = (event) => {
    const container = containerRef.current;

    if (!container?.contains(event.relatedTarget) && !container?.matches(':hover')) {
      setIsOpen(false);
    }
  };

  const closeOnMouseLeave = () => {
    if (!containerRef.current?.contains(document.activeElement)) {
      setIsOpen(false);
    }
  };

  return (
    <div
      className={`glossary-menu ${isOpen ? 'open' : ''}`}
      onBlur={closeOnBlur}
      onFocus={() => setIsOpen(true)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={closeOnMouseLeave}
      ref={containerRef}
    >
      <button
        aria-controls="glossary-panel"
        aria-expanded={isOpen}
        aria-label="Terms glossary"
        className="glossary-trigger"
        type="button"
      >
        <HelpCircle size={18} />
      </button>

      {isOpen && (
        <section className="glossary-panel" id="glossary-panel">
          <div className="glossary-head">
            <h2>Terms</h2>
            <span>{filteredTerms.length}/{glossaryTerms.length}</span>
          </div>

          <label className="glossary-search">
            <Search size={16} />
            <input
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search terms"
              type="search"
              value={query}
            />
          </label>

          <div className="glossary-results">
            {isLoading ? (
              <p className="glossary-empty">Loading terms...</p>
            ) : error ? (
              <p className="glossary-empty">{error}</p>
            ) : filteredTerms.length > 0 ? filteredTerms.map((item) => (
              <article className="glossary-term" key={item.id ?? item.term}>
                <div>
                  <strong>{item.term}</strong>
                  <span>{item.category}</span>
                </div>
                <p>{item.definition}</p>
              </article>
            )) : (
              <p className="glossary-empty">No terms found.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
