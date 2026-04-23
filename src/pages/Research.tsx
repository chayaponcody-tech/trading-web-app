import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  BookOpen, Edit3, Save, Trash2, Plus, 
  FileText, BrainCircuit, Clock, ChevronRight, ChevronDown,
  Search, Star, Hash, Calendar, LayoutGrid, List, Filter,
  TrendingUp, TrendingDown, Minus, Info, AlertTriangle, ArrowRight
} from 'lucide-react';

interface ResearchFile {
  name: string;
  filename: string;
  lastModified: string;
  tags: string[];
  category: string;
}

export default function ResearchBrain() {
  const [files, setFiles] = useState<ResearchFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [targetCategory, setTargetCategory] = useState('General');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'system_knowledge': true,
    'scout_reports': true,
    'General': true
  });

  const API_BASE = '/api/research';

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/files`);
      const data = await res.json();
      // Sort by last modified descending
      const sorted = data.sort((a: ResearchFile, b: ResearchFile) => 
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
      setFiles(sorted);
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
    const pathPrefix = targetCategory === 'General' ? '' : `${targetCategory}/`;
    const filename = newFileName.endsWith('.md') ? `${pathPrefix}${newFileName}` : `${pathPrefix}${newFileName}.md`;
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

  const allAvailableTags = useMemo(() => {
    const counts: Record<string, number> = {};
    files.forEach(f => {
      f.tags?.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [files]);

  const filteredFiles = useMemo(() => {
    let result = files;
    if (activeFilterTag) {
      result = result.filter(f => f.tags?.includes(activeFilterTag));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => 
        f.name.toLowerCase().includes(q) || 
        f.category.toLowerCase().includes(q) ||
        f.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [files, activeFilterTag, searchQuery]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const groupedFiles = useMemo(() => {
    return filteredFiles.reduce((acc, file) => {
      const cat = file.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(file);
      return acc;
    }, {} as Record<string, ResearchFile[]>);
  }, [filteredFiles]);

  const handleDelete = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const formatShortName = (name: string) => {
    if (name.startsWith('scout_report_')) {
      const parts = name.split('_');
      if (parts.length >= 3) {
        const date = parts[2]; // 20260417
        const time = parts[3]?.split('.')[0]; // 153529
        return `Report ${date.slice(6,8)}/${date.slice(4,6)} ${time?.slice(0,2)}:${time?.slice(2,4)}`;
      }
    }
    return name;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('th-TH', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  const recentFiles = files.slice(0, 4);

  return (
    <div className="research-container">
      
      {/* Sidebar: Navigation & Search */}
      <aside className="research-sidebar glass-panel">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon"><BrainCircuit size={20} /></div>
            <h2>Research Brain</h2>
          </div>
          <button 
            onClick={() => setShowNewFileInput(!showNewFileInput)} 
            className="btn-icon-circular"
            title="Create New Entry"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search reports, tags..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="clear-search">×</button>}
        </div>

        <div className="sidebar-scrollable">
          {/* New File Input Overlay */}
          {showNewFileInput && (
            <div className="new-file-form animate-slide-down">
              <input 
                type="text" 
                placeholder="Filename..." 
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                autoFocus
              />
              <select 
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
              >
                <option value="General">General</option>
                <option value="system_knowledge">System Knowledge</option>
                <option value="scout_reports">Scout Reports</option>
              </select>
              <div className="form-actions">
                <button onClick={() => setShowNewFileInput(false)} className="btn-text">Cancel</button>
                <button onClick={handleCreateFile} className="btn-primary-sm">Create</button>
              </div>
            </div>
          )}

          {/* Nav Sections */}
          <div className="nav-section">
            <button 
              className={`nav-item ${!activeFile ? 'active' : ''}`}
              onClick={() => setActiveFile(null)}
            >
              <LayoutGrid size={18} />
              <span>Intelligence Dashboard</span>
            </button>
          </div>

          {/* Grouped Files List */}
          <div className="grouped-sections">
            {Object.entries(groupedFiles).length === 0 && (
              <div className="empty-search">
                <Info size={32} opacity={0.3} />
                <p>No reports match your search</p>
              </div>
            )}
            
            {Object.entries(groupedFiles).map(([category, items]) => {
              const isExpanded = expandedCategories[category] !== false;
              return (
                <div key={category} className="category-group">
                  <div 
                    onClick={() => toggleCategory(category)}
                    className="category-header"
                  >
                    <div className="flex-center gap-2">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} 
                      <span className="category-title">
                        {category.replace(/system_knowledge/g, 'System Knowledge').replace(/scout_reports/g, 'Scout Reports')}
                      </span>
                    </div>
                    <span className="count-badge">{items.length}</span>
                  </div>
                  
                  {isExpanded && (
                    <div className="file-items animate-fade-in">
                      {items.map(file => (
                        <div 
                          key={file.filename}
                          onClick={() => loadContent(file.filename)}
                          className={`file-item ${activeFile === file.filename ? 'selected' : ''}`}
                        >
                          <div className="file-icon">
                            {file.category.includes('scout') ? <TrendingUp size={14} color="#0ecb81" /> : <FileText size={14} />}
                          </div>
                          <div className="file-info">
                            <div className="file-name">{formatShortName(file.name)}</div>
                            <div className="file-meta">
                              <Clock size={10} /> {new Date(file.lastModified).toLocaleDateString('th-TH')}
                            </div>
                          </div>
                          <div className="file-actions">
                            <Trash2 size={12} className="delete-icon" onClick={(e) => handleDelete(file.filename, e)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Tag Cloud at bottom of sidebar */}
        <div className="sidebar-footer">
          <div className="tags-header">
            <Hash size={14} /> <span>Trending Tags</span>
          </div>
          <div className="tag-cloud">
            {allAvailableTags.slice(0, 10).map(([tag, count]) => (
              <span 
                key={tag}
                onClick={() => setActiveFilterTag(tag === activeFilterTag ? null : tag)}
                className={`tag-pill ${tag === activeFilterTag ? 'active' : ''}`}
              >
                {tag} <small>{count}</small>
              </span>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="research-main glass-panel">
        {activeFile ? (
          /* Editor/Viewer Page */
          <div className="article-container">
            <div className="article-header">
              <div className="breadcrumb">
                <span className="crumb-link" onClick={() => setActiveFile(null)}>Brain</span>
                <ChevronRight size={12} />
                <span className="crumb-current">{activeFile.split('/').pop()?.replace('.md', '')}</span>
              </div>
              
              <div className="article-title-row">
                <div className="title-section">
                  <h1>{formatShortName(activeFile.split('/').pop()?.replace('.md', '') || '')}</h1>
                  <div className="title-metadata">
                    <span className="meta-item"><Calendar size={14} /> {formatDate(files.find(f => f.filename === activeFile)?.lastModified || '')}</span>
                    <span className="meta-item"><Hash size={14} /> {activeFile.split('/')[0].replace('_', ' ')}</span>
                  </div>
                </div>
                
                <div className="article-actions">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditing(false)} className="btn-secondary">Cancel</button>
                      <button onClick={handleSave} className="btn-primary flex-center gap-2">
                        <Save size={18} /> Save Changes
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setIsEditing(true)} className="btn-outline flex-center gap-2">
                      <Edit3 size={18} /> Edit Note
                    </button>
                  )}
                </div>
              </div>

              {/* Tags Editor/Display */}
              <div className="article-tags">
                {tags.map(tag => (
                  <span key={tag} className="tag-badge">
                    #{tag}
                    {isEditing && <button className="remove-tag" onClick={() => removeTag(tag)}>×</button>}
                  </span>
                ))}
                {isEditing && (
                  <div className="add-tag-inline">
                    <input 
                      type="text" 
                      placeholder="Add tag..." 
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    />
                    <Plus size={14} onClick={addTag} />
                  </div>
                )}
              </div>
            </div>

            <div className={`article-content ${isEditing ? 'editing' : 'viewing'}`}>
              {loading ? (
                <div className="loader-container">
                  <div className="loader"></div>
                  <p>Decrypting Intelligence...</p>
                </div>
              ) : isEditing ? (
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Start writing your research notes here..."
                  autoFocus
                />
              ) : (
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Dashboard Page */
          <div className="dashboard-view animate-fade-in">
            <div className="dashboard-header">
              <div className="welcome">
                <h1>Intelligence Hub</h1>
                <p>Aggregated market insights and system knowledge</p>
              </div>
              <div className="dashboard-stats">
                <div className="stat-card">
                  <div className="label">Total Reports</div>
                  <div className="value">{files.length}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Latest Tags</div>
                  <div className="value">{allAvailableTags.length}</div>
                </div>
              </div>
            </div>

            <div className="dashboard-grid">
              {/* Recent Reports Section */}
              <section className="dashboard-section recent-reports">
                <div className="section-header">
                  <div className="flex-center gap-2">
                    <Clock size={20} className="text-secondary" />
                    <h3>Recent Intelligence</h3>
                  </div>
                  <button className="btn-text">View All <ChevronRight size={14} /></button>
                </div>
                
                <div className="reports-grid">
                  {recentFiles.map(file => (
                    <div key={file.filename} className="report-card" onClick={() => loadContent(file.filename)}>
                      <div className="card-top">
                        <span className={`category-tag ${file.category.includes('scout') ? 'scout' : 'knowledge'}`}>
                          {file.category.includes('scout') ? 'Scout' : 'System'}
                        </span>
                        <span className="card-time">{new Date(file.lastModified).toLocaleDateString()}</span>
                      </div>
                      <h4 className="card-title">{formatShortName(file.name)}</h4>
                      <div className="card-tags">
                        {file.tags.slice(0, 2).map(t => <span key={t} className="mini-tag">#{t}</span>)}
                        {file.tags.length > 2 && <span className="mini-tag">+{file.tags.length - 2}</span>}
                      </div>
                      <div className="card-footer">
                        <span className="read-more">Analyze Report <ArrowRight size={14} /></span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Categories/Knowledge Areas */}
              <section className="dashboard-section knowledge-areas">
                <div className="section-header">
                  <h3>Knowledge Areas</h3>
                </div>
                <div className="areas-list">
                  <div className="area-item" onClick={() => { setSearchQuery('scout_reports'); setExpandedCategories({scout_reports: true}); }}>
                    <div className="area-icon scout"><TrendingUp size={24} /></div>
                    <div className="area-text">
                      <span className="area-name">Scout Reports</span>
                      <span className="area-desc">Market scanning and alpha discovery</span>
                    </div>
                    <div className="area-count">{files.filter(f => f.category.includes('scout')).length}</div>
                  </div>
                  <div className="area-item" onClick={() => { setSearchQuery('system_knowledge'); setExpandedCategories({system_knowledge: true}); }}>
                    <div className="area-icon brain"><BrainCircuit size={24} /></div>
                    <div className="area-text">
                      <span className="area-name">System Knowledge</span>
                      <span className="area-desc">Architecture, policies and internal logic</span>
                    </div>
                    <div className="area-count">{files.filter(f => f.category.includes('system')).length}</div>
                  </div>
                  <div className="area-item" onClick={() => { setSearchQuery('General'); setExpandedCategories({General: true}); }}>
                    <div className="area-icon general"><FileText size={24} /></div>
                    <div className="area-text">
                      <span className="area-name">General Documents</span>
                      <span className="area-desc">Manuals, registries and other notes</span>
                    </div>
                    <div className="area-count">{files.filter(f => !f.category.includes('scout') && !f.category.includes('system')).length}</div>
                  </div>
                </div>
              </section>

              {/* Action Pulse / Insights Placeholder */}
              <section className="dashboard-section pulse-section glass-panel">
                <div className="pulse-header">
                  <div className="flex-center gap-2">
                    <span className="pulse-dot"></span>
                    <h3>System Pulse</h3>
                  </div>
                  <span className="pulse-time">LIVE</span>
                </div>
                <div className="pulse-content">
                  <div className="pulse-item">
                    <AlertTriangle size={20} color="#faad14" />
                    <div className="pulse-text">
                      <strong>Volatililty Alert:</strong> Recent scout reports indicate high sentiment shifts in top 10 tokens.
                    </div>
                  </div>
                  <div className="pulse-item">
                    <Star size={20} color="#00d1ff" />
                    <div className="pulse-text">
                      <strong>Alpha Discovery:</strong> New pattern "Hidden Orderblock" registered in knowledge base.
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Styled Components CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --sidebar-width: 320px;
          --bg-card: rgba(30, 32, 38, 0.7);
          --accent-primary: #00d1ff;
          --accent-secondary: #0ecb81;
          --text-muted: #848e9c;
          --border-dim: rgba(255, 255, 255, 0.08);
        }

        .research-container {
          display: flex;
          gap: 1.5rem;
          height: calc(100vh - 120px);
          max-width: 1600px;
          margin: 0 auto;
          color: #eaecef;
        }

        /* Sidebar Styling */
        .research-sidebar {
          width: var(--sidebar-width);
          display: flex;
          flex-direction: column;
          padding: 0;
          overflow: hidden;
          background: rgba(11, 14, 17, 0.6);
          border-radius: 16px;
        }

        .sidebar-header {
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-dim);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .brand-icon {
          width: 36px;
          height: 36px;
          background: rgba(0, 209, 255, 0.1);
          color: var(--accent-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
        }

        .brand h2 {
          font-size: 1.1rem;
          margin: 0;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .search-box {
          margin: 1rem 1.5rem;
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          color: var(--text-muted);
        }

        .search-box input {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border-dim);
          border-radius: 12px;
          padding: 0.6rem 1rem 0.6rem 2.5rem;
          color: #fff;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .search-box input:focus {
          border-color: var(--accent-primary);
          background: rgba(0, 0, 0, 0.5);
          outline: none;
          box-shadow: 0 0 0 4px rgba(0, 209, 255, 0.05);
        }

        .sidebar-scrollable {
          flex: 1;
          overflow-y: auto;
          padding: 0 1rem 1.5rem;
        }

        .nav-section {
          margin-bottom: 1.5rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem 1rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .nav-item.active {
          background: rgba(0, 209, 255, 0.1);
          color: var(--accent-primary);
        }

        .category-group {
          margin-bottom: 0.75rem;
        }

        .category-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .category-header:hover {
          color: #fff;
        }

        .count-badge {
          background: rgba(255, 255, 255, 0.05);
          padding: 1px 6px;
          border-radius: 6px;
          font-size: 0.7rem;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 0.75rem;
          margin: 2px 0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }

        .file-item:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .file-item.selected {
          background: rgba(0, 209, 255, 0.08);
          border-color: rgba(0, 209, 255, 0.2);
        }

        .file-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-muted);
        }

        .file-item.selected .file-icon {
          background: rgba(0, 209, 255, 0.15);
          color: var(--accent-primary);
        }

        .file-info {
          flex: 1;
          overflow: hidden;
        }

        .file-name {
          font-size: 0.85rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-meta {
          font-size: 0.7rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.25rem;
          margin-top: 2px;
        }

        .delete-icon {
          opacity: 0;
          color: #f6465d;
          transition: opacity 0.2s;
        }

        .file-item:hover .delete-icon {
          opacity: 0.6;
        }

        .delete-icon:hover {
          opacity: 1 !important;
        }

        .sidebar-footer {
          padding: 1.5rem;
          border-top: 1px solid var(--border-dim);
          background: rgba(0, 0, 0, 0.1);
        }

        .tags-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: var(--text-muted);
        }

        .tag-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .tag-pill {
          padding: 3px 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-dim);
          border-radius: 20px;
          font-size: 0.7rem;
          cursor: pointer;
          color: var(--text-muted);
          transition: all 0.2s;
        }

        .tag-pill:hover, .tag-pill.active {
          background: rgba(0, 209, 255, 0.1);
          border-color: var(--accent-primary);
          color: var(--accent-primary);
        }

        /* Main Content Styling */
        .research-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 0;
          overflow: hidden;
          background: rgba(11, 14, 17, 0.4);
          border-radius: 16px;
        }

        /* Dashboard View */
        .dashboard-view {
          padding: 3rem;
          height: 100%;
          overflow-y: auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 3rem;
        }

        .welcome h1 { 
          font-size: 2.5rem; 
          margin: 0 0 0.5rem 0; 
          background: linear-gradient(to right, #fff, #888);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .welcome p { color: var(--text-muted); font-size: 1.1rem; }

        .dashboard-stats {
          display: flex;
          gap: 2rem;
        }

        .stat-card {
           background: rgba(255, 255, 255, 0.03);
           padding: 1.5rem;
           border-radius: 16px;
           min-width: 140px;
           border: 1px solid var(--border-dim);
        }

        .stat-card .label { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; }
        .stat-card .value { font-size: 1.8rem; font-weight: 700; color: var(--accent-primary); }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
        }

        .dashboard-section { margin-bottom: 2rem; }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .section-header h3 { font-size: 1.2rem; margin: 0; }

        .reports-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 1rem;
        }

        .report-card {
          background: var(--bg-card);
          padding: 1.5rem;
          border-radius: 16px;
          border: 1px solid var(--border-dim);
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .report-card:hover {
          transform: translateY(-5px);
          border-color: var(--accent-primary);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .card-top { display: flex; justify-content: space-between; font-size: 0.7rem; }
        .category-tag { padding: 2px 8px; border-radius: 4px; font-weight: 600; }
        .category-tag.scout { background: rgba(14, 203, 129, 0.1); color: #0ecb81; }
        .category-tag.knowledge { background: rgba(0, 209, 255, 0.1); color: #00d1ff; }

        .card-title { font-size: 1rem; margin: 0; height: 3rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        
        .card-tags { display: flex; gap: 0.4rem; }
        .mini-tag { font-size: 0.65rem; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 4px; }

        .read-more { font-size: 0.8rem; color: var(--accent-primary); font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }

        .areas-list { display: flex; flex-direction: column; gap: 1rem; }
        .area-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem;
          background: rgba(255,255,255,0.02);
          border-radius: 16px;
          border: 1px solid var(--border-dim);
          cursor: pointer;
          transition: all 0.2s;
        }

        .area-item:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
        .area-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .area-icon.scout { background: rgba(14, 203, 129, 0.1); color: #0ecb81; }
        .area-icon.brain { background: rgba(167, 139, 250, 0.1); color: #a78bfa; }
        .area-icon.general { background: rgba(0, 209, 255, 0.1); color: #00d1ff; }

        .area-text { flex: 1; display: flex; flex-direction: column; }
        .area-name { font-weight: 600; font-size: 1rem; }
        .area-desc { font-size: 0.75rem; color: var(--text-muted); }
        .area-count { font-size: 1.2rem; font-weight: 700; opacity: 0.5; }

        .pulse-section {
          grid-column: span 2;
          background: linear-gradient(135deg, rgba(0, 209, 255, 0.05) 0%, rgba(14, 203, 129, 0.05) 100%);
          padding: 2rem;
          border-radius: 20px;
        }

        .pulse-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .pulse-dot { width: 8px; height: 8px; background: #0ecb81; border-radius: 50%; box-shadow: 0 0 10px #0ecb81; }
        .pulse-time { font-size: 0.7rem; font-weight: 700; color: #0ecb81; opacity: 0.8; }
        
        .pulse-content { display: flex; flex-direction: column; gap: 1rem; }
        .pulse-item { display: flex; gap: 1rem; align-items: flex-start; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 12px; }
        .pulse-text { font-size: 0.9rem; line-height: 1.5; color: #ccc; }

        /* Article View Styling */
        .article-container {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .article-header { padding: 2rem 3rem 1.5rem; border-bottom: 1px solid var(--border-dim); }
        .breadcrumb { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem; }
        .crumb-link { cursor: pointer; }
        .crumb-link:hover { color: var(--accent-primary); }

        .article-title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
        .article-title-row h1 { font-size: 2.2rem; margin: 0; font-weight: 800; letter-spacing: -0.03em; }
        .title-metadata { display: flex; gap: 1.5rem; color: var(--text-muted); margin-top: 0.5rem; font-size: 0.85rem; }
        .meta-item { display: flex; align-items: center; gap: 0.5rem; }

        .article-tags { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1rem; }
        .tag-badge { background: rgba(0, 209, 255, 0.1); color: var(--accent-primary); padding: 4px 12px; border-radius: 100px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
        .remove-tag { background: none; border: none; color: var(--accent-primary); cursor: pointer; font-size: 1.1rem; padding: 0; display: flex; align-items: center; }

        .add-tag-inline { display: flex; align-items: center; border-bottom: 1px dashed var(--border-dim); padding-bottom: 2px; }
        .add-tag-inline input { background: none; border: none; color: #fff; font-size: 0.75rem; width: 80px; outline: none; }

        .article-content { flex: 1; overflow-y: auto; padding: 3rem; position: relative; }
        .article-content.editing { padding: 1rem; background: rgba(0,0,0,0.2); }
        .article-content.editing textarea { width: 100%; height: 100%; background: transparent; border: none; color: #d1d1d1; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 1.05rem; line-height: 1.7; outline: none; resize: none; }

        /* Markdown Overrides */
        .markdown-body { font-size: 1.1rem; line-height: 1.8; color: #d1d1d1; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #fff; margin-top: 2rem; }
        .markdown-body h1 { font-size: 1.8rem; border-bottom: 1px solid var(--border-dim); padding-bottom: 0.5rem; }
        .markdown-body code { background: rgba(255,255,255,0.08); padding: 0.2rem 0.4rem; border-radius: 6px; color: #faad14; }
        .markdown-body pre { background: rgba(0,0,0,0.4); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-dim); overflow-x: auto; }
        .markdown-body blockquote { border-left: 4px solid var(--accent-primary); background: rgba(0, 209, 255, 0.05); padding: 1rem 1.5rem; margin: 2rem 0; border-radius: 0 12px 12px 0; }
        .markdown-body table { border-collapse: separate; border-spacing: 0; width: 100%; margin: 2rem 0; border: 1px solid var(--border-dim); border-radius: 12px; overflow: hidden; }
        .markdown-body th { background: rgba(255,255,255,0.03); padding: 1rem; text-align: left; border-bottom: 1px solid var(--border-dim); font-weight: 700; color: #fff; }
        .markdown-body td { padding: 1rem; border-bottom: 1px solid var(--border-dim); }

        /* Utilities */
        .flex { display: flex; }
        .flex-center { display: flex; align-items: center; }
        .flex-between { display: flex; justify-content: space-between; align-items: center; }
        .gap-2 { gap: 0.75rem; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        .animate-slide-down { animation: slideDown 0.3s ease-out; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }

        .btn-icon-circular { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border-dim); background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .btn-icon-circular:hover { background: var(--accent-primary); color: #000; border-color: var(--accent-primary); }
        
        .loader-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 1rem; opacity: 0.6; }
        .loader { width: 40px; height: 40px; border: 3px solid rgba(0, 209, 255, 0.1); border-top-color: var(--accent-primary); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* New Form Overlay */
        .new-file-form { padding: 1rem; background: rgba(0, 209, 255, 0.05); border: 1px solid rgba(0, 209, 255, 0.2); border-radius: 12px; margin-bottom: 1.5rem; }
        .new-file-form input, .new-file-form select { width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border-dim); color: #fff; border-radius: 6px; }
        .form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

        button.btn-primary-sm { background: var(--accent-primary); color: #000; border: none; padding: 0.4rem 1rem; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 0.8rem; }
        button.btn-text { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.8rem; }
        button.btn-text:hover { color: #fff; }
      `}} />
    </div>
  );
}
