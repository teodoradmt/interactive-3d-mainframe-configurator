import { HelpCircle, Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

const glossaryTerms = [
  {
    term: 'Mainframe',
    category: 'System View',
    definition: 'Mainframes are data servers designed to process up to 1 trillion web transactions daily with the highest levels of security and reliability.',
  },
  {
    term: 'CPC',
    category: 'Compute',
    definition: 'Central Processor Complex. The processor drawer that provides the main compute capacity for IBM Z workloads.',
  },
  {
    term: 'Processor Complex',
    category: 'Compute',
    definition: 'The compute section of the system, including processor capacity, accelerator capacity, and workload headroom.',
  },
  {
    term: 'LPAR',
    category: 'Virtualization',
    definition: 'Logical Partition. A hardware-isolated partition used to run separate operating environments on the same mainframe.',
  },
  {
    term: 'RAIM',
    category: 'Memory',
    definition: 'Redundant Array of Independent Memory. A resilient memory design used to improve reliability and availability.',
  },
  {
    term: 'External DASD',
    category: 'External Storage',
    definition: 'Direct Access Storage Device represented here only as an optional external storage cabinet, not as a CPC module.',
  },
  {
    term: 'I/O Connectivity Drawers',
    category: 'CPC I/O',
    definition: 'The CPC module for OSA, FICON, Fibre Channel, and high-throughput links. It provides connectivity, not DASD capacity.',
  },
  {
    term: 'FICON',
    category: 'I/O',
    definition: 'Fiber Connection. A high-speed IBM Z channel protocol commonly used to connect storage and tape systems.',
  },
  {
    term: 'Fibre Channel',
    category: 'I/O',
    definition: 'A storage networking technology used in SAN environments for fast and reliable data transfer.',
  },
  {
    term: 'SAN',
    category: 'Storage',
    definition: 'Storage Area Network. A dedicated network that connects servers to shared storage systems.',
  },
  {
    term: 'OSA',
    category: 'Network',
    definition: 'Open Systems Adapter. IBM Z networking hardware used for TCP/IP and Ethernet connectivity.',
  },
  {
    term: 'HMC',
    category: 'Management',
    definition: 'Hardware Management Console. A management interface used to configure, monitor, and operate IBM Z hardware.',
  },
  {
    term: 'Support Element',
    category: 'Management',
    definition: 'A service processor used for low-level hardware control, diagnostics, and platform operations.',
  },
  {
    term: 'I/O Fabric',
    category: 'I/O',
    definition: 'The connectivity layer that links the mainframe to external storage, network, tape, and recovery systems.',
  },
  {
    term: 'Crypto Express',
    category: 'Security',
    definition: 'A hardware cryptographic feature used for secure key handling, encryption, and compliance-focused workloads.',
  },
  {
    term: 'Pervasive Encryption',
    category: 'Security',
    definition: 'An IBM Z approach for encrypting data broadly across applications, databases, and storage with reduced application changes.',
  },
  {
    term: 'Quantum-safe security',
    category: 'Security',
    definition: 'Security planning and cryptography intended to reduce risk from future quantum-computing attacks.',
  },
  {
    term: 'Tape',
    category: 'External Backup',
    definition: 'A removable-media backup and retention technology represented here through the optional external Tape Library module.',
  },
  {
    term: 'Tape Library',
    category: 'External Backup',
    definition: 'The optional external automated tape system used for backup, long-term retention, and air-gapped recovery workflows.',
  },
  {
    term: 'Cyber Vault',
    category: 'External Recovery',
    definition: 'An optional external recovery copy tier used to isolate critical data and support recovery after cyber incidents.',
  },
  {
    term: 'Air-gapped backup',
    category: 'Backup',
    definition: 'A backup copy separated from normal network access so attackers cannot easily modify or delete it.',
  },
  {
    term: 'Rear Door Heat Exchanger',
    category: 'Cooling',
    definition: 'A cooling attachment that removes heat at the rear of the frame before it enters the datacenter room.',
  },
  {
    term: 'Liquid Cooling',
    category: 'Cooling',
    definition: 'A cooling method that uses liquid to support higher density and higher performance hardware configurations.',
  },
  {
    term: 'Frame',
    category: 'Infrastructure',
    definition: 'The physical cabinet layout that houses the mainframe hardware and supporting infrastructure.',
  },
  {
    term: 'Z Frame',
    category: 'Infrastructure',
    definition: 'The primary mainframe frame used for core CPC, memory, I/O, security, power, and cooling modules.',
  },
  {
    term: 'A Frame',
    category: 'Infrastructure',
    definition: 'An additional frame used when the selected configuration needs more infrastructure or external-system support.',
  },
  {
    term: 'Capacity score',
    category: 'Assessment',
    definition: 'A demo metric in this configurator that compares relative compute strength between selectable options.',
  },
  {
    term: 'AI score',
    category: 'Assessment',
    definition: 'A demo metric that compares how AI-oriented a selected processor or security option is inside the configurator.',
  },
  {
    term: 'Estimated consumption',
    category: 'Assessment',
    definition: 'The approximate power draw calculated from the selected modules and cooling efficiency.',
  },
];

function normalizeSearchValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function GlossaryMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
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
  }, [normalizedQuery]);

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
            {filteredTerms.length > 0 ? filteredTerms.map((item) => (
              <article className="glossary-term" key={item.term}>
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
