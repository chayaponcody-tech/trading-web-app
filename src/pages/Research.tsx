import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  BookOpen, Edit3, Save, Trash2, Plus, 
  FileText, BrainCircuit, Clock, ChevronRight
} from 'lucide-react';

interface ResearchFile {
  name: string;
  filename: string;
  lastModified: string;
}

export default function ResearchBrain() {
  const [files, setFiles] = useState<ResearchFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const API_BASE = 'http://localhost:4001/api/research';

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/files`);
      const data = await res.json();
      setFiles(data);
      if (data.length > 0 && !activeFile) {
        loadContent(data[0].filename);
      }
    } catch (e) {
      console.error('Failed to fetch research files', e);
    }
  };

  const loadContent = async (filename: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/content/${filename}`);
      const data = await res.json();
      setContent(data.content);
      setTags(data.tags || []);
      setActiveFile(filename);
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to load file content', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeFile) return;
    try {
      await fetch(`${API_BASE}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: activeFile, content, tags })
      });
      setIsEditing(false);
      fetchFiles();
    } catch (e) {
      alert('Failed to save file');
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName) return;
    const filename = newFileName.endsWith('.md') ? newFileName : `${newFileName}.md`;
    try {
      await fetch(`${API_BASE}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: `# ${newFileName}\n\nเริ่มพิมพ์ข้อความตรงนี้...`, tags: [] })
      });
      setNewFileName('');
      setShowNewFileInput(false);
      await fetchFiles();
      loadContent(filename);
    } catch (e) {
      alert('Failed to create file');
    }
  };

  const addTag = () => {
    if (tagInput && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const allAvailableTags = Array.from(new Set(files.flatMap(f => f.tags || [])));

  const filteredFiles = activeFilterTag 
    ? files.filter(f => f.tags?.includes(activeFilterTag))
    : files;

  const handleDelete = async (filename: string) => {
    if (!confirm(`ต้องการลบไฟล์ ${filename} ใช่หรือไม่?`)) return;
    try {
      await fetch(`${API_BASE}/${filename}`, { method: 'DELETE' });
      setFiles(files.filter(f => f.filename !== filename));
      if (activeFile === filename) {
        setActiveFile(null);
        setContent('');
        setTags([]);
      }
    } catch (e) {
        alert('Failed to delete file');
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 180px)', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Sidebar: File List */}
      <aside className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
            <BookOpen size={20} /> Knowledge Base
          </div>
          <button 
            onClick={() => setShowNewFileInput(!showNewFileInput)} 
            style={{ background: 'rgba(0,122,255,0.1)', border: 'none', color: 'var(--accent-primary)', padding: '0.3rem', borderRadius: '4px', cursor: 'pointer' }}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Tag Filter */}
        {allAvailableTags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <span 
              onClick={() => setActiveFilterTag(null)}
              style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: !activeFilterTag ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)', color: !activeFilterTag ? '#000' : '#888', cursor: 'pointer', fontWeight: 'bold' }}
            >
              All
            </span>
            {allAvailableTags.map(tag => (
              <span 
                key={tag}
                onClick={() => setActiveFilterTag(tag === activeFilterTag ? null : tag)}
                style={{ 
                  fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', 
                  background: tag === activeFilterTag ? 'var(--accent-primary)' : 'rgba(0,122,255,0.1)', 
                  color: tag === activeFilterTag ? '#000' : 'var(--accent-primary)', 
                  cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {showNewFileInput && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input 
              type="text" 
              placeholder="ชื่อไฟล์..." 
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.4rem', color: '#fff', fontSize: '0.85rem' }}
            />
            <button onClick={handleCreateFile} className="btn-primary" style={{ padding: '0.4rem 0.8rem' }}>Add</button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredFiles.map(file => (
            <div 
              key={file.filename}
              onClick={() => loadContent(file.filename)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem', 
                padding: '0.75rem 1rem', 
                borderRadius: '8px', 
                cursor: 'pointer',
                background: activeFile === file.filename ? 'rgba(0,122,255,0.1)' : 'transparent',
                border: activeFile === file.filename ? '1px solid var(--accent-primary)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
              className="research-file-item"
            >
              <FileText size={18} color={activeFile === file.filename ? 'var(--accent-primary)' : '#888'} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: activeFile === file.filename ? 'bold' : 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file.name}
                </div>
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                  {file.tags?.slice(0, 2).map(tag => (
                    <span key={tag} style={{ fontSize: '0.55rem', color: 'var(--accent-primary)', opacity: 0.7 }}>#{tag}</span>
                  ))}
                  {(file.tags?.length || 0) > 2 && <span style={{ fontSize: '0.55rem', color: '#555' }}>...</span>}
                </div>
              </div>
              {activeFile === file.filename && <Trash2 size={14} color="#f6465d" onClick={(e) => { e.stopPropagation(); handleDelete(file.filename); }} />}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content: Viewer / Editor */}
      <main className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
        {activeFile ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Edit3 size={18} color="#888" />
                  <h4 style={{ margin: 0 }}>{activeFile.replace('.md', '')}</h4>
                </div>
                {/* Active Tags Display/Editor */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                  {tags.map(tag => (
                    <span 
                      key={tag} 
                      style={{ 
                        fontSize: '0.7rem', 
                        background: 'linear-gradient(135deg, rgba(0,122,255,0.1) 0%, rgba(0,122,255,0.05) 100%)', 
                        color: 'var(--accent-primary)', 
                        padding: '2px 10px', 
                        borderRadius: '12px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.4rem',
                        border: '1px solid rgba(0,122,255,0.2)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      <span style={{ opacity: 0.6 }}>#</span>{tag}
                      {isEditing && (
                        <span 
                          style={{ cursor: 'pointer', fontWeight: 'bold', marginLeft: '2px', fontSize: '0.8rem', opacity: 0.8 }} 
                          onClick={() => removeTag(tag)}
                        >
                          ×
                        </span>
                      )}
                    </span>
                  ))}
                  {isEditing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: '0.5rem' }}>
                      <input 
                        type="text" 
                        placeholder="Add tag..." 
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #444', color: '#fff', fontSize: '0.7rem', outline: 'none', width: '80px' }}
                      />
                      <Plus size={12} style={{ cursor: 'pointer', color: 'var(--accent-primary)' }} onClick={addTag} />
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(false)} className="btn-outline" style={{ padding: '0.4rem 1rem' }}>Cancel</button>
                    <button onClick={handleSave} className="btn-primary" style={{ padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Save size={16} /> Save Note
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="btn-outline" style={{ padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Edit3 size={16} /> Edit
                  </button>
                )}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
              {isEditing ? (
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: '#ccc', fontFamily: 'monospace', fontSize: '1rem', lineHeight: '1.6', outline: 'none', resize: 'none' }}
                />
              ) : (
                <div className="markdown-body" style={{ color: '#eee', lineHeight: '1.8' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
             <BookOpen size={64} opacity={0.2} style={{ marginBottom: '1.5rem' }} />
             <p>เลือกไฟล์จากด้านซ้ายเพื่อเริ่มอ่าน หรือกด + เพื่อสร้างบันทึกใหม่</p>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .markdown-body h1 { border-bottom: 2px solid var(--accent-primary); padding-bottom: 0.5rem; margin: 2rem 0 1rem; color: #fff; }
        .markdown-body h2 { margin: 1.5rem 0 1rem; color: var(--accent-primary); }
        .markdown-body h3 { margin: 1.25rem 0 0.75rem; color: #fff; }
        .markdown-body ul, .markdown-body ol { padding-left: 1.5rem; margin-bottom: 1rem; }
        .markdown-body li { margin-bottom: 0.5rem; }
        .markdown-body code { background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; color: #faad14; }
        .markdown-body pre { background: rgba(0,0,0,0.4); padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1.5rem 0; border: 1px solid var(--border-color); }
        .markdown-body blockquote { border-left: 4px solid var(--accent-primary); background: rgba(0,122,255,0.05); padding: 0.5rem 1rem; margin: 1.5rem 0; font-style: italic; }
        .markdown-body table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; background: rgba(255,255,255,0.02); border-radius: 8px; overflow: hidden; }
        .markdown-body th { background: rgba(0,122,255,0.1); color: var(--accent-primary); padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); }
        .markdown-body td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); color: #ccc; }
        .markdown-body tr:last-child td { border-bottom: none; }
        .markdown-body tr:hover td { background: rgba(255,255,255,0.01); }
        .research-file-item:hover { background: rgba(255,255,255,0.05) !important; }
      `}} />
    </div>
  );
}
