## Chạy test

### Chạy test cơ bản:
```bash
npm test
```

Hoặc:
```bash
newman run Library_API_Postman_Collection.json
```

### Chạy test với report HTML:
```bash
npm run test:report
```

Hoặc:
```bash
newman run Library_API_Postman_Collection.json -r cli,html --reporter-html-export newman-report.html
```

Report HTML sẽ được tạo tại file `newman-report.html`

## Các tùy chọn khác

### Chạy với environment variables:
```bash
newman run Library_API_Postman_Collection.json -e environment.json
```

### Chạy với số lần lặp lại:
```bash
newman run Library_API_Postman_Collection.json -n 3
```

### Chạy với delay giữa các request:
```bash
newman run Library_API_Postman_Collection.json --delay-request 1000
```

### Chạy với timeout:
```bash
newman run Library_API_Postman_Collection.json --timeout-request 5000
```

### Chỉ chạy một folder cụ thể:
```bash
newman run Library_API_Postman_Collection.json --folder "Authentication"
```

### Chạy với nhiều reporters:
```bash
newman run Library_API_Postman_Collection.json -r cli,json,html --reporter-html-export report.html --reporter-json-export report.json
```

## Lưu ý

1. **Đảm bảo server đang chạy** trước khi chạy newman:
   ```bash
   npm start
   ```

2. **Base URL** đã được set trong collection variable: `http://localhost:5008`

3. **Token** sẽ được tự động lưu sau khi login (nếu có test script)

4. Có thể tạo file `environment.json` để override variables:
   ```json
   {
     "id": "library-env",
     "name": "Library API Environment",
     "values": [
       {
         "key": "base_url",
         "value": "http://localhost:5008",
         "type": "default"
       }
     ]
   }
   ```

## Kết quả

Newman sẽ hiển thị:
- Tổng số requests đã chạy
- Số requests thành công/thất bại
- Thời gian thực thi
- Chi tiết từng request và response
- Test assertions (nếu có)

## CI/CD Integration

Có thể tích hợp vào CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Run API Tests
  run: |
    npm install
    npm start &
    sleep 5
    npm test
```

