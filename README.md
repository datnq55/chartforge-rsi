# ChartForge RSI

ChartForge RSI là PWA phân tích thị trường Binance Spot, chạy trực tiếp trên desktop và mobile. Bản `0.4.15` có chart nến, RSI, công cụ vẽ, Bar Replay, lưu offline và đồng bộ tùy chọn qua tài khoản Google.

## Chạy local

```bash
npm ci
npx --yes http-server web -p 4173 -c-1
```

Mở `http://localhost:4173/?symbol=BTCUSDT`. Có thể đổi symbol thành `ETHUSDT` hoặc `DOGEUSDT`. Service Worker cần HTTPS hoặc `localhost`.

## Tính năng

- Khung thời gian: `30m`, `H1`, `H2`, `H4`, `H8`, `H12`, `D`, `3D`, `1W`, `2W`, `M`.
- Dữ liệu lịch sử và realtime từ Binance public REST/WebSocket, không cần API key.
- RSI 14 Wilder/RMA, EMA 9 và WMA 45.
- Pan/zoom, price scale neo theo điểm nhấn, tải thêm lịch sử và tối đa 1.000 bar hiển thị. Khi kéo time scale, khoảng cách nến co giãn quanh mép phải như TradingView: mốc thời gian dưới chuột di chuyển cùng con trỏ, chart không bị pan ngoài ý muốn và khoảng trống tương lai được giữ ổn định theo số bar.
- Time scale tự đổi mật độ theo mức zoom: ưu tiên mốc năm/tháng và lần lượt hiện thêm ngày, giờ, phút khi có đủ khoảng trống; mật độ trung bình dùng cadence lịch thoáng hơn (ví dụ ngày 1/6/11/16/21/26) và vẫn chuyển về từng ngày khi zoom sâu.
- Fibonacci Retracement, Long Position, Price Range, Date Range, Trend Line và Text.
- Nút Trash dùng hộp thoại xác nhận trong ứng dụng giống khi thoát Replay; hủy không thay đổi dữ liệu, còn xác nhận xóa vẫn có thể Undo.
- Bar Replay bằng Select Bar, Select Date hoặc ngày đầu tiên; Play/Pause, Forward, tốc độ, đổi timeframe và xác nhận khi thoát.
- Tiêu đề tab cập nhật giá realtime theo symbol hiện tại.
- Nhãn các nút timeframe được căn giữa bằng flex với line box cố định, giữ đúng tâm trong khung chọn trên Chrome mobile và màn hình có DPR phân số.
- Nến, grid, crosshair và các đường scale thẳng được căn theo pixel vật lý để giữ nét sắc trên màn hình thường, Retina và các mức DPR phân số.
- Desktop hỗ trợ Shift-lock khi tạo hoặc kéo anchor Trend Line; mobile không có Snap.
- Logo mới dùng hai khung định vị hình học đối nhau quanh một điểm chuẩn tím, được đồng bộ cho topbar, favicon và icon cài PWA; thiết kế vector phẳng, không chữ cái, gradient hay hiệu ứng trang trí.

Topbar và bottom toolbar là vùng cố định. Bottom toolbar có separator mỏng chạy suốt chiều ngang để tách khỏi canvas và các scale/rail. Price/RSI canvas chỉ vẽ trong khoảng trống linh hoạt ở giữa; kéo RSI về mức nhỏ nhất không thể che bottom toolbar. Cụm OHLC và thay đổi giá tự xuống dòng trên mobile, không tràn vào price scale. Trên mobile, giao diện theo `visualViewport` và safe area thực tế nên thanh trình duyệt động không cắt phần dưới ứng dụng.

Thanh công cụ trái đặt Undo, Redo và Trash ngay sau nhóm công cụ vẽ; countdown đóng nến chỉ hiển thị thời lượng sau một separator và tự ẩn trong Replay. Các giá trị RSI, EMA và WMA nằm bên trái bottom toolbar.

## Lưu dữ liệu

Ứng dụng luôn lưu trước vào IndexedDB và hoạt động khi chưa đăng nhập. Đăng nhập Google sẽ bật đồng bộ Firestore theo từng UID. Settings và drawings được đồng bộ; market cache, Replay và Undo/Redo chỉ nằm trên thiết bị hoặc trong RAM phiên hiện tại.

Menu tài khoản có xuất/nhập backup JSON. Không đưa service-account JSON hoặc Firebase Admin secret vào repo. Firebase Web config là metadata public dành cho trình duyệt.

## Kiểm tra

```bash
npm run validate:pwa
npm run test:pwa
npm test
```

`npm test` cần Java để chạy Firestore Emulator. Browser smoke test cần local server ở cổng 4173:

```bash
npm run smoke:pwa
```

## Deploy

Push nhánh `main` sẽ kích hoạt workflow GitHub Pages và publish thư mục `web/` tại `https://datnq55.github.io/chartforge-rsi/`. Firestore Rules không tự deploy cùng Pages.
