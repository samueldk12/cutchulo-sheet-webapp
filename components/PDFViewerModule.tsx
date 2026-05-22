'use client';

import React, { useState, useEffect } from 'react';

interface Book {
  name: string;
  size: number;
  modified: string;
}

interface Annotation {
  id: number;
  filename: string;
  page: number;
  note: string;
  color: string;
}

interface SearchMatch {
  context: string;
  page: number;
  matchText: string;
}

interface SearchResult {
  book: string;
  matches: SearchMatch[];
}

export default function PDFViewerModule() {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // New annotation fields
  const [noteText, setNoteText] = useState('');
  const [notePage, setNotePage] = useState('1');
  const [noteColor, setNoteColor] = useState('yellow');
  
  const [uploading, setUploading] = useState(false);

  // Load books
  const loadBooks = async () => {
    try {
      const res = await fetch('/api/books');
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
        if (data.length > 0 && !selectedBook) {
          setSelectedBook(data[0].name);
        }
      }
    } catch (err) {
      console.error('Erro ao listar livros:', err);
    }
  };

  // Load annotations
  const loadAnnotations = async (filename: string) => {
    try {
      const res = await fetch(`/api/pdf-annotations?filename=${encodeURIComponent(filename)}`);
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data);
      }
    } catch (err) {
      console.error('Erro ao buscar anotações:', err);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  useEffect(() => {
    if (selectedBook) {
      loadAnnotations(selectedBook);
      setNotePage('1');
      setNoteText('');
    }
  }, [selectedBook]);

  // Handle Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(searchQuery)}&regex=${useRegex}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Erro na pesquisa de texto:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Create annotation
  const handleCreateAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !noteText.trim()) return;

    try {
      const res = await fetch('/api/pdf-annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedBook,
          page: parseInt(notePage, 10) || 1,
          note: noteText,
          color: noteColor
        })
      });

      if (res.ok) {
        setNoteText('');
        loadAnnotations(selectedBook);
      }
    } catch (err) {
      console.error('Erro ao criar anotação:', err);
    }
  };

  // Delete annotation
  const handleDeleteAnnotation = async (id: number) => {
    try {
      const res = await fetch(`/api/pdf-annotations/${id}`, {
        method: 'DELETE'
      });
      if (res.ok && selectedBook) {
        loadAnnotations(selectedBook);
      }
    } catch (err) {
      console.error('Erro ao excluir anotação:', err);
    }
  };

  // Upload book file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const newBook = await res.json();
        await loadBooks();
        setSelectedBook(newBook.name);
      } else {
        const errorData = await res.json();
        alert(`Erro de Upload: ${errorData.error}`);
      }
    } catch (err) {
      console.error('Erro ao enviar livro:', err);
    } finally {
      setUploading(false);
    }
  };

  // Delete book file
  const handleDeleteBook = async (filename: string) => {
    if (!confirm(`Deseja realmente banir este livro do grimório: ${filename}?`)) return;
    try {
      const res = await fetch(`/api/books/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setBooks(books.filter(b => b.name !== filename));
        if (selectedBook === filename) {
          setSelectedBook(books.length > 1 ? books.find(b => b.name !== filename)!.name : null);
        }
      }
    } catch (err) {
      console.error('Erro ao banir livro:', err);
    }
  };

  return (
    <div className="pdf-grid">
      {/* Books and Control Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
        
        {/* Books List Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.85rem', color: 'var(--text-gold)' }}>Livros do Grimório</h3>
            <label className="btn-occult" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer' }}>
              {uploading ? 'Carregando...' : '+ Subir PDF'}
              <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
            {books.map(b => (
              <div 
                key={b.name} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: selectedBook === b.name ? 'rgba(140,12,16,0.15)' : 'rgba(0,0,0,0.2)',
                  borderColor: selectedBook === b.name ? 'var(--border-crimson)' : 'transparent',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderRadius: '4px',
                  padding: '0.4rem 0.6rem',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedBook(b.name)}
              >
                <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }} title={b.name}>
                  📚 {b.name}
                </span>
                <button 
                  type="button" 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteBook(b.name); }}
                  title="Banir Grimório"
                >
                  ×
                </button>
              </div>
            ))}
            {books.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>Nenhum PDF carregado.</span>}
          </div>
        </div>

        {/* Text Search Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>Pesquisa Oculta (Regex)</h3>
          
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
            <input
              type="text"
              className="gothic-input"
              style={{ padding: '0.4rem', fontSize: '0.8rem' }}
              placeholder="Digite palavra ou regex..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />
                Usar RegEx
              </label>
              <button type="submit" className="btn-occult btn-cyan" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }} disabled={isSearching}>
                {isSearching ? 'Buscando...' : 'Pesquisar'}
              </button>
            </div>
          </form>

          {searchResults.length > 0 && (
            <div className="pdf-search-results" style={{ maxHeight: '180px', marginTop: '0.5rem' }}>
              {searchResults.map(res => (
                <div key={res.book}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', display: 'block', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.2rem', marginBottom: '0.3rem' }}>
                    {res.book}
                  </span>
                  {res.matches.map((m, idx) => (
                    <div 
                      key={idx} 
                      className="pdf-search-match"
                      onClick={() => { setSelectedBook(res.book); alert(`Vá para a Página ${m.page} para ver este trecho.`); }}
                    >
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', display: 'block' }}>Página {m.page}</span>
                      <span style={{ fontSize: '0.75rem', fontStyle: 'italic', display: 'block', color: 'var(--text-secondary)' }}>
                        "...{m.context}..."
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Annotations List */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--accent-gold)' }}>Anotações da Página</h3>
          
          <form onSubmit={handleCreateAnnotation} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input
                type="number"
                className="gothic-input"
                style={{ padding: '0.3rem', fontSize: '0.8rem' }}
                placeholder="Pág"
                value={notePage}
                onChange={(e) => setNotePage(e.target.value)}
              />
              <select
                className="gothic-select"
                style={{ padding: '0.3rem', fontSize: '0.8rem' }}
                value={noteColor}
                onChange={(e) => setNoteColor(e.target.value)}
              >
                <option value="yellow">Amarelo</option>
                <option value="red">Vermelho</option>
                <option value="cyan">Ciano</option>
                <option value="gold">Ouro</option>
              </select>
            </div>
            <textarea
              className="gothic-input"
              style={{ padding: '0.4rem', fontSize: '0.8rem', minHeight: '50px' }}
              placeholder="Sua anotação ou pista..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <button type="submit" className="btn-occult" style={{ padding: '0.4rem', fontSize: '0.75rem' }}>
              Salvar Anotação
            </button>
          </form>

          {/* Annotations Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto', marginTop: '0.5rem' }}>
            {annotations.map(ann => (
              <div 
                key={ann.id} 
                style={{ 
                  background: 'rgba(0,0,0,0.3)',
                  borderLeft: `3px solid ${
                    ann.color === 'red' ? 'var(--text-crimson)' :
                    ann.color === 'cyan' ? 'var(--accent-cyan)' :
                    ann.color === 'gold' ? 'var(--text-gold)' : 'yellow'
                  }`,
                  borderRadius: '0 4px 4px 0',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-gold)' }}>Página {ann.page}</span>
                  <button 
                    onClick={() => handleDeleteAnnotation(ann.id)} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.3' }}>{ann.note}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Dynamic Native PDF Panel */}
      <div className="pdf-viewer-container">
        {selectedBook ? (
          <iframe 
            src={`/api/books/${encodeURIComponent(selectedBook)}`} 
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={selectedBook}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '3rem' }}>📖</span>
            <span>Selecione um grimório no painel esquerdo para invocar suas páginas</span>
          </div>
        )}
      </div>

    </div>
  );
}
