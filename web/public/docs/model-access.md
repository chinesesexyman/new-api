# API Documentation

## Endpoint

- Gateway URL: `{{SERVER_ADDRESS}}`

## Get an API Key

To access the API, you need an API key. Follow these steps to get your key:

1. Sign in to the console
2. Go to the token page and create a new token
3. Configure that token in your client or backend service

## Common Endpoints

Commonly used endpoints include:

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/completions`
- `GET /v1beta/models`

## Curl Examples

### 1. Chat Completions

```bash
curl {{SERVER_ADDRESS}}/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-5.3-latest",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "hello, who are you?"}
    ]
  }'
```

### 2. Streaming Output

```bash
curl {{SERVER_ADDRESS}}/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-5.3-latest",
    "stream": true,
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "hello, who are you?"}
    ]
  }'
```

### 3. OpenAI-Codex API

```bash
curl {{SERVER_ADDRESS}}/v1/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-5.3-codex",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "hello, who are you?"}
    ]
  }'
```
