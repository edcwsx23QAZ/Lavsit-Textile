# TextileNova Parser Service

Standalone service for parsing TextileNova supplier data.

## Endpoints

### POST /parse
Parse fabrics from URL with rules.

Request body:
```json
{
  "url": "https://textilnova.ru/...",
  "rules": {
    "skipRows": [1],
    "skipPatterns": ["заголовок"],
    "specialRules": {}
  }
}
```

### POST /analyze
Analyze URL and return structure.

Request body:
```json
{
  "url": "https://textilnova.ru/..."
}
```

### GET /health
Health check endpoint.

## Deployment

### Render.com

1. Connect your GitHub repository
2. Set build command: `npm install && npm run build`
3. Set start command: `npm start`
4. Set environment: Node.js
5. Add environment variable: `NODE_ENV=production`

### Railway

1. Connect your GitHub repository
2. Railway will auto-detect Node.js
3. Build command: `npm install && npm run build`
4. Start command: `npm start`

