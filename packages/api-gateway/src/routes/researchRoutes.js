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

  // GET /api/research/files - List all markdown files with tags
  router.get('/files', (req, res) => {
    try {
      const files = fs.readdirSync(researchDir)
        .filter(file => file.endsWith('.md'))
        .map(file => {
          const filePath = path.join(researchDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const { data } = matter(content);
          return {
            name: file.replace('.md', ''),
            filename: file,
            lastModified: fs.statSync(filePath).mtime,
            tags: data.tags || []
          };
        });
      res.json(files);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/research/content/:filename - Get file content without frontmatter
  router.get('/content/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      if (!filename.endsWith('.md')) {
        return res.status(400).json({ error: 'Only markdown files allowed' });
      }
      const filePath = path.join(researchDir, filename);
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

  // POST /api/research/save - Save or update a markdown file with tags
  router.post('/save', (req, res) => {
    try {
      const { filename, content, tags = [] } = req.body;
      if (!filename || content === undefined) {
        return res.status(400).json({ error: 'Missing filename or content' });
      }
      const cleanFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
      const filePath = path.join(researchDir, cleanFilename);
      
      // Construct file with frontmatter
      const fileWithFrontmatter = matter.stringify(content, { tags });
      
      fs.writeFileSync(filePath, fileWithFrontmatter, 'utf8');
      res.json({ success: true, filename: cleanFilename });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/research/:filename - Delete a file
  router.delete('/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(researchDir, filename);
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
