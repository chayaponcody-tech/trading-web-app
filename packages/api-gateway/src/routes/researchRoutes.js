import express from 'express';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export function createResearchRoutes() {
  const router = express.Router();
  const researchDir = path.resolve('research');

  // Ensure directory exists
  if (!fs.existsSync(researchDir)) {
    fs.mkdirSync(researchDir);
  }

  // Helper to get files recursively
  const getFiles = (dir, rootDir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFiles(filePath, rootDir));
      } else if (file.endsWith('.md')) {
        const relativePath = path.relative(rootDir, filePath);
        const category = path.dirname(relativePath) === '.' ? 'General' : path.dirname(relativePath).replace(/[\\/]/g, ' / ');
        const content = fs.readFileSync(filePath, 'utf8');
        const { data } = matter(content);
        results.push({
          name: path.basename(file, '.md'),
          filename: relativePath.replace(/\\/g, '/'),
          lastModified: stat.mtime,
          tags: data.tags || [],
          category: category
        });
      }
    });
    return results;
  };

  // GET /api/research/files - List all markdown files with categories and tags
  router.get('/files', (req, res) => {
    try {
      const files = getFiles(researchDir, researchDir);
      res.json(files);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/research/content/* - Get file content using encoded relative path
  router.get('/content/*', (req, res) => {
    try {
      const relativePath = req.params[0];
      if (!relativePath.endsWith('.md')) {
        return res.status(400).json({ error: 'Only markdown files allowed' });
      }
      const filePath = path.join(researchDir, relativePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { content, data } = matter(fileContent);
      res.json({ content, tags: data.tags || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/research/save - Save or update a markdown file
  router.post('/save', (req, res) => {
    try {
      const { filename, content, tags = [] } = req.body;
      if (!filename || content === undefined) {
        return res.status(400).json({ error: 'Missing filename or content' });
      }
      const cleanFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
      const filePath = path.join(researchDir, cleanFilename);
      
      // Ensure target directory exists
      const targetDir = path.dirname(filePath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fileWithFrontmatter = matter.stringify(content, { tags });
      fs.writeFileSync(filePath, fileWithFrontmatter, 'utf8');
      res.json({ success: true, filename: cleanFilename });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/research/* - Delete a file
  router.delete('/*', (req, res) => {
    try {
      const relativePath = req.params[0];
      const filePath = path.join(researchDir, relativePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
