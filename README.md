# ChartForge RSI

ChartForge RSI 3.10.7 vẽ chart nến Binance, RSI và các công cụ phân tích trong cùng dialog. Hai pane dùng chung time scale nên luôn hiển thị đúng cùng tập nến khi kéo hoặc zoom.

## Công thức

- RSI chính: RSI 14 (Wilder/RMA, giống `ta.rsi`)
- Đường nhanh: EMA 9 của RSI
- Đường chậm: WMA 45 của RSI
- Mức 30/70 nét liền; các mức 10–90 và vùng màu mô phỏng script Pine gốc
- Nền trắng bán trong suốt để vẫn nhìn thấy chart phía dưới
- Giữ các region fill trong suốt của Pine gốc; từng bar được tô xanh khi RSI > 80 hoặc cam khi RSI < 20

## Cài đặt

1. Giải nén thư mục này.
2. Mở `chrome://extensions` (Chrome) hoặc `edge://extensions` (Edge).
3. Bật **Developer mode**.
4. Chọn **Load unpacked** và chọn thư mục `chartforge-rsi`.
5. Mở trang Binance Spot dạng `https://www.binance.com/.../trade/BTC_USDT`.

Nhấn biểu tượng extension để bật/tắt. Kéo tiêu đề để di chuyển; kéo bất kỳ cạnh hoặc góc nào của viền dialog để chỉnh chiều rộng và chiều cao.

Kéo ngang trực tiếp trên biểu đồ để xem quá khứ. Nhấp đúp hoặc bấm **Cập nhật** để tải lại dữ liệu và trở về giá hiện tại mà không đổi timeframe.

Trục thời gian theo múi giờ trình duyệt nằm dưới đồ thị và tự đổi định dạng theo timeframe.

Rê chuột trên đồ thị để hiện crosshair dọc bám vào bar gần nhất và nhãn ngày giờ nền tối trên trục thời gian, giống hành vi TradingView.

- Kéo chart giá hoặc RSI: cả hai pane cùng dịch chuyển.
- Cuộn chuột trên chart giá hoặc RSI: cả hai pane cùng zoom.
- Crosshair của hai pane bám cùng một bar.
- Đây là chart giá do extension vẽ từ OHLC Binance, không phải widget chart gốc của Binance.
- Nến tăng: thân trắng, viền và râu đen. Nến giảm: thân, viền và râu đen.
- Kéo phần trục thời gian sang trái/phải để zoom; rê vào trục sẽ có con trỏ hai chiều.
- Kéo chart sang trái để tạo khoảng trắng bên phải mà không sinh nến tương lai.
- Nút **Reset** đưa zoom, vị trí ngang, vị trí dọc và tỷ lệ hai pane về mặc định.
- Nút `✛` bật chế độ kéo chart giá lên/xuống.
- Kéo nút `↕` giữa chart và RSI để thay đổi chiều cao hai pane.
- Dữ liệu realtime được dedupe theo `openTime`; tick chỉ cập nhật nến hiện tại và chỉ thêm khi xuất hiện một openTime mới hợp lệ.
- Zoom bằng trục thời gian giữ bar neo đi theo vị trí con trỏ hiện tại trong suốt thao tác kéo.
- Khi bật `✛`, một lần kéo có thể pan chart đồng thời theo cả chiều ngang và chiều dọc.
- Rê vào price scale bên phải có cursor dọc; khi nhấn-kéo, mức giá ngay dưới vị trí nhấn được giữ cố định trên màn hình và các mức giá khác phóng to hoặc thu nhỏ xung quanh điểm neo đó, giống TradingView.
- Kéo price scale và time scale có độ nhạy chậm, dễ kiểm soát hơn. Price scale dùng hệ số `0.003` mỗi pixel, snapshot lúc pointer-down và độ dịch chuyển tuyệt đối nên không bị nhảy ở lần di chuyển đầu hoặc tích lũy sai số; time scale vẫn giữ bar dưới con trỏ làm anchor và giữ nguyên độ nhạy.
- Topbar giữ `RSI · <symbol>` sát mép trái, tiếp theo là các timeframe, separator và Replay; chỉ trạng thái nằm sát phải. Chấm trạng thái màu xanh biểu thị LIVE, vàng biểu thị đang tải/kết nối và đỏ biểu thị replay, lỗi hoặc mất kết nối.
- Chrome Storage được truy cập qua lớp bảo vệ context và mọi tác vụ bất đồng bộ chạy nền đều có điểm xử lý lỗi cuối: tab Binance cũ còn tồn tại sau khi reload extension sẽ không phát sinh unhandled promise rejection `Extension context invalidated`. Tab đang chạy content script từ bản cũ vẫn cần refresh một lần để nạp bản sửa mới.
- Tên `RSI · <symbol>` nằm bên trái topbar, trước các khung thời gian; trạng thái `LIVE`, tải dữ liệu, lỗi hoặc replay nằm sát phía phải topbar.
- Góc trái bottom toolbar hiển thị thời gian còn lại đến lúc đóng nến hiện tại và cập nhật mỗi giây. Mốc đóng nến theo đúng interval Binance, gồm biên 2 tuần và tháng lịch; đồng hồ được ẩn hoàn toàn trong Bar Replay.
- Zoom thời gian hỗ trợ tối đa 1.000 bar.
- Tick H4 bám biên ngày/tháng và tự chọn bước 1/2/3/5… ngày theo độ rộng viewport.
- Các tick thời gian có grid dọc mờ chạy xuyên cả chart giá và RSI.
- Hover pane giá có crosshair dọc và ngang; đường ngang kết thúc bằng nhãn giá trên price scale.
- Hover vào một cây nến sẽ hiện O/H/L/C, mức thay đổi và phần trăm thay đổi ở góc trên bên trái của chart giá; màu xanh cho nến tăng và đỏ cho nến giảm.
- Dialog có viền hiển thị rõ và tám vùng resize ở bốn cạnh/bốn góc; kích thước và vị trí mới được ghi nhớ.
- Nút `↕` không nhận focus bàn phím, không hiện caret và không cho chọn ký tự khi nhấn hoặc kéo.
- Toolbar dọc bên trái có công cụ **Fibonacci Retracement**. Chọn `F↗`, đặt điểm đầu rồi đặt điểm cuối; cũng có thể nhấn-kéo-thả để hoàn thành nhanh.
- Fibo gồm các mức `0`, `0.236`, `0.382`, `0.5`, `0.618`, `0.786`, `1`; các đường/vùng dùng màu xám và riêng mức/vùng `0.5` dùng màu hồng.
- Fibo được neo theo thời gian và giá, vì vậy đi cùng nến khi pan/zoom và được dùng chung cho mọi timeframe của cùng symbol.
- Nhấn vào vùng Fibo để chọn và mở menu công cụ nổi. Menu dùng kiến trúc action chung cho drawing tool; bản này cung cấp nút xóa Fibo.
- Trục thời gian từ `D` trở lên bám ranh giới lịch như TradingView: `D/3D` ưu tiên tháng, `1W/2W` ưu tiên nửa năm, `M` ưu tiên năm; mốc tháng 1 hiển thị năm thay vì `Jan`.
- Mật độ mốc lịch tự thích nghi theo độ rộng và mức zoom, đồng thời grid dọc của chart giá và RSI dùng chung chính xác các mốc này.
- Sửa lỗi khung `M` bị ẩn/hiện nến khi kéo trong trường hợp số nến lịch sử ít hơn số slot đang hiển thị. Các slot thiếu nay là khoảng trắng thật và không còn cắt nến hiện có.
- **Long Position (`L▥`)**: đặt entry và target; hiển thị vùng target xanh, vùng stop đỏ, phần trăm và tỷ lệ risk/reward. Stop mặc định đối xứng với khoảng target.
- **Price Range (`↕$`)**: đo chênh lệch giá và phần trăm giữa hai điểm, với vùng đo xanh và nhãn kết quả.
- **Date Range**: đo số bar, thời lượng và tổng volume giữa hai mốc thời gian. Thời lượng lấy từ chênh lệch timestamp thực tế, dùng `D` làm đơn vị lớn nhất rồi tới `h` và `m` (ví dụ `9D`, `1D 1h`, `8D 9h 30m`), không quy đổi sang tuần. Vùng cam và mũi tên xanh mô phỏng TradingView; khi chọn, hai mốc ngày/giờ màu xanh xuất hiện trên time scale. Khi kéo cả vùng hoặc chỉnh anchor, đường dash dọc dưới con trỏ và nhãn thời gian cập nhật ngay trong lúc kéo. Icon dùng đúng bố cục một mũi tên sang phải, hai đường mốc bất đối xứng và hai điểm neo của mẫu TradingView.
- **Trend Line (`╱`)**: vẽ đường đỏ 4px giữa hai điểm. Giữ `Shift` trong lúc đặt điểm cuối để khóa thành đường ngang hoặc đường dọc theo hướng gần nhất. Khi chọn Trend Line trên price pane, giá của hai đầu mút được hiển thị bằng nhãn cùng màu trên price scale nhưng không vẽ đường gióng ngang; Trend Line trên RSI pane không hiện nhãn giá này.
- Ba tool mới dùng chung cơ chế preview, hai-click hoặc kéo-thả, chọn hình, menu nổi và xóa như Fibo.
- Drawing được lưu đầy đủ trong `chrome.storage.local` và đồng bộ theo từng shard qua `chrome.storage.sync`.
- Kéo trực tiếp drawing để di chuyển toàn bộ đối tượng; kéo các điểm neo màu xanh để sửa từng đầu mút. Long Position có điểm neo riêng cho Entry, Target và Stop.
- Toolbar nổi của drawing có tay nắm và có thể kéo tới vị trí khác.
- Slider Zoom ở bottom toolbar đã được ẩn; zoom bằng chuột và trục thời gian vẫn hỗ trợ tối đa 1.000 bar.
- Bottom toolbar có nút fullscreen; nhấn lại để trở về đúng vị trí và kích thước trước đó.
- Badge thu gọn có thể kéo đi nơi khác; nhấn không kéo để mở lại.
- Bỏ thông báo `+ … khoảng trống` khỏi bottom toolbar và thay các ký tự nút bằng bộ icon SVG đồng nhất.
- Vertical pan được quy đổi theo price range hiện tại: nội dung chart đi đúng quãng đường tương đối với con trỏ ở mọi mức price zoom, không còn trôi nhanh/chậm hơn chuột.
- Long Position khi được chọn có ba đường gióng tới price scale cùng nhãn Target/Entry/Stop màu tương ứng; khi bỏ chọn sẽ ẩn toàn bộ nhãn và điểm neo để chart gọn hơn.
- Price Range luôn giữ nhãn số đo, nhưng chỉ hiện điểm neo và đường gióng giá khi được chọn; đường đo có mũi tên hai đầu như TradingView.
- Khi kéo điểm neo hoặc cả drawing, crosshair ngang và nhãn giá tại con trỏ vẫn hoạt động để đối chiếu chính xác mức giá.
- Giá đóng cửa realtime của nến mới nhất có đường chấm ngang xuyên chart và nhãn nền đen trên price scale như TradingView.
- Price Range giữ nguyên chiều đo A → B: kéo dưới lên cho số dương/mũi tên lên, kéo trên xuống cho số âm/mũi tên xuống. Trục mũi tên luôn nằm chính giữa chiều ngang vùng đo và nhãn nằm ở đầu đích.
- **Text Tool**: chọn biểu tượng `T`, bấm vị trí trên chart và nhập trực tiếp. `Enter` lưu, `Shift+Enter` xuống dòng, `Esc` hủy; text được neo theo thời gian/giá và kéo được như drawing khác.
- Khi chọn Text, toolbar nổi có color picker và font size từ 10–48px; style lưu riêng theo từng text.
- Khi chọn Trend Line, toolbar nổi có color picker, line width 1–8px và kiểu `Solid`, `Dash`, `Dot`; các trend line cũ tự dùng mặc định đỏ, 4px, Solid.
- Sửa lỗi click ra chart khi đang nhập text tạo editor mới và làm mất editor cũ; thao tác này giờ lưu và đóng đúng editor hiện tại.
- Trend Line nay vẽ, chọn, kéo cả đường và chỉnh hai điểm neo được trực tiếp trên pane RSI; hình vẽ vẫn đi cùng time scale chung.
- Toolbar trái rộng hơn, toàn bộ icon SVG drawing dùng nét 1px mảnh đồng nhất theo phong cách TradingView, căn giữa và bỏ hoàn toàn shadow. Rule riêng của drawing rail bảo đảm nét mảnh không bị style SVG chung của button ghi đè.
- Khi nhấn-kéo để tạo Date Range lần đầu, đường dash dọc và nhãn thời gian dùng chung của hai pane bám theo endpoint B ngay trong lúc giữ chuột; tạo bằng hai click vẫn giữ nguyên hành vi.
- Chế độ kéo dọc chart giá được bật mặc định cho cài đặt mới.
- Bộ logo ChartForge mới được đóng gói ở đủ kích thước 16/32/48/128px và dùng cho icon extension/action.
- Toolbar trái nay là một rail kéo dài từ đỉnh chart tới bottom toolbar; nhóm drawing nằm trên, nút xóa tất cả nằm sát đáy sau separator.
- Nút xóa tất cả xóa bộ drawing dùng chung của symbol đang mở trên mọi timeframe, có bước xác nhận để tránh thao tác nhầm.
- Cài đặt và drawing được ghi đồng thời vào `chrome.storage.sync` và `chrome.storage.local`; dữ liệu local cũ được tự di chuyển lên sync, local tiếp tục làm bản dự phòng.
- Tất cả timeframe của cùng một symbol dùng chung một bộ drawing. Dữ liệu cũ từng lưu riêng theo timeframe được tự gộp và loại bỏ bản trùng khi nâng cấp.
- Text ghi nhớ màu chữ và font size gần nhất; Trend Line ghi nhớ màu, line width và kiểu Solid/Dash/Dot. Preset được dùng cho drawing mới và đồng bộ qua Chrome.
- Logo được thiết kế lại bằng vector phẳng hai màu, không gradient, glow, 3D hay chi tiết thừa; badge thu gọn hiển thị logo thay cho mũi tên.
- Manifest có public key cố định để bản `Load unpacked` giữ cùng Extension ID trên các máy.
- Sync drawing dùng từng item riêng theo `cfrsi:d:<f|t>:<symbol>:<index>` thay vì dồn toàn bộ vào hai key lớn. Local vẫn giữ bản đầy đủ để extension hoạt động khi Chrome Sync đang offline.
- Khai báo icon badge collapse là web-accessible resource riêng cho Binance, sửa lỗi biểu tượng ảnh hỏng trong Shadow DOM.
- Undo/Redo tối đa 100 bước cho tạo, xóa, xóa tất cả, kéo, sửa điểm neo và đổi style drawing. Có nút ở cuối toolbar cùng phím tắt chuẩn; lịch sử chỉ ở RAM của phiên hiện tại, không lưu local/sync.
- Price scale bên phải là lớp nền trắng đặc nằm trên chart/drawing; tick giá, giá realtime, giá hover và nhãn gióng của drawing được render lại trên lớp trên cùng.
- Price scale được nới rộng và toàn bộ phép pan/zoom/hit-test dùng cùng plot width mới, tránh cắt mất chữ số của giá.
- Nhấp đúp Text đã lưu để mở lại editor; Enter hoặc click ra ngoài lưu nội dung mới, Esc hủy. Chỉnh text tham gia Undo/Redo.
- Nhãn giá hover đo đúng chiều rộng logic của canvas theo device-pixel-ratio và tự co font khi chuỗi giá dài, không còn tràn/cắt ở mép phải.
- Price scale có lớp bắt sự kiện riêng nằm trên canvas, nên kéo để zoom giá không thể chọn hoặc di chuyển drawing bên dưới.
- Các timeframe được chuyển lên topbar riêng để chừa bottom toolbar cho nhóm điều khiển chart và mở rộng công cụ sau này.
- Thêm timeframe `30m`. Khi kéo các timeframe nhỏ tới đầu lịch sử đang có, extension tự tải tiếp từng lô tối đa 1.000 nến cũ và giữ nguyên vùng đang xem.
- Icon drawing ở rail trái được tăng kích thước và vẽ lại theo ngôn ngữ icon nét mảnh của TradingView.
- Mọi button trong bottom toolbar đều có trạng thái hover đồng nhất.

## Bar Replay

- Nút **Replay** nằm ngay sau nhóm timeframe, có separator riêng và mở chế độ mô phỏng dữ liệu lịch sử theo phong cách TradingView. Khi chưa chọn, hover dùng nền xám nhạt giống các nút thông thường; nút chỉ chuyển nền đen và chữ trắng sau khi Replay được bật.
- **Select bar** là chế độ mặc định và nhãn này luôn được giữ trên thanh điều khiển. Đường cắt màu xanh xuất hiện trên cả price pane và RSI pane; nến đang hover và được bấm sẽ bị cắt khỏi chart ngay, rồi xuất hiện ở bước Forward/Play đầu tiên. Sau khi cắt, chart dùng animation ease-in-out chậm để đưa vùng replay về vị trí bắt đầu.
- Có thể bấm lại **Replay** hoặc chọn lại **Select bar** ngay trong phiên replay để cắt tiếp tại một nến cũ hơn; thao tác này không thoát replay.
- **Select date…** nhận ngày và giờ cụ thể, tải trực tiếp cửa sổ dữ liệu quanh thời điểm đó từ Binance. Có thể chọn năm 2023 hoặc xa hơn nếu symbol đã có dữ liệu trên Binance.
- **Select the first available day** tự tìm nến đầu tiên Binance còn lưu cho symbol và timeframe hiện tại.
- Thanh replay có Play/Pause, tiến từng nến, dropdown tốc độ không có mũi tên với các mức `0.25x`, `0.5x`, `1x`, `2x`, `3x`, `5x`, `10x`, timeframe hiện tại và nút trở về realtime. Khi thoát sẽ có hộp xác nhận để tránh bấm nhầm.
- Có thể đổi giữa `30m`, `H1`, `H2`, `H4`, `H8`, `H12`, `D`, `3D`, `1W`, `2W`, `M` trong khi replay; timestamp đang mô phỏng được giữ nguyên và dữ liệu của timeframe mới được tải quanh cùng thời điểm.
- Replay chỉ tồn tại trong RAM của phiên hiện tại; điểm bắt đầu, thời gian, tốc độ và trạng thái phát không được ghi vào `chrome.storage.local` hoặc `chrome.storage.sync`. Thay đổi này không đụng tới manifest key hay schema drawing sync.

Nút `▾/RSI ▴` thu gọn thành badge vàng nổi và khôi phục panel mà vẫn giữ vị trí, kích thước, timeframe và zoom.

## Lưu ý

- Extension chỉ đọc dữ liệu thị trường công khai từ Binance; không yêu cầu API key và không truy cập lệnh/tài khoản.
- Đây là overlay độc lập, không phải Pine Script chạy native trong TradingView widget của Binance.
- Các khung: 30m, H1, H2, H4, H8, H12, D, 3D, 1W, 2W, M. Chỉ khung được chọn mới tải và hiển thị.
- `2W` được tổng hợp từ nến `1W`, vì Spot API không phát interval `2W` trực tiếp.
- Extension tải ban đầu 1.000 nến và tự nạp thêm từng lô khi kéo đến đầu lịch sử ở các khung nhỏ.
