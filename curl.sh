curl -X POST "https://forums.testdriver.ai/users" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_ADMIN_API_KEY" \
  -H "Api-Username: admin" \
  -d '{
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "username": "janedoe",
    "active": false,
    "approved": true,
    "email_verified": false,
    "staged": false
  }'
