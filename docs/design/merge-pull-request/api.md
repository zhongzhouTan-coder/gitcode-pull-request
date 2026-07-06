
# Merge Pull Request API

## API Description

This API allows users to merge an existing pull request in a repository.

## Endpoints

```
PUT https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/merge
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `number`: Pull Request number.

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Request Body

The request body should be in JSON format and include the following fields:

```json
{
    "merge_method": "Optional. Method to merge the PR, which can be merge (merge all commits), squash (flatten branch merge), or rebase (rebase and merge). The default is merge.",
    "title": "Optional. Merge title.",
    "description": "Optional. Merge description.",
    "force_merge": "Is it mandatory to merge (requires enabling the \"Allow Admins to Force Merge\" setting, and requires admin permissions)"
}
```

## Example Request

```bash
curl --request PUT \
  --url https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls/1/merge \
  --header 'Authorization: Bearer xxxxxxxxxxxxxxxxxxx' \
  --header 'Content-Type: application/json' \
  --data '{
    "merge_method": "merge",
    "title": "Optional. Merge title.",
    "description": "Optional. Merge description.",
    "force_merge": false
}'
```

## Example Response

200 OK

```json
{
	"sha": "67b4cfaf49d7b26c6a97601df156c66afbfc19e3",
	"merged": true,
	"message": "Pull Request 已成功合并"
}
```
