# XLC Signage TV

Ứng dụng React + Next.js cho **Xôi Lá Chuối (XLC)**. Một nhà hàng, một mã PIN quản lý. Chưa dùng Supabase hoặc database nhiều người dùng.

## Chạy trên máy

Yêu cầu Node.js 22 trở lên, npm. Repository có `.nvmrc`; có thể chạy `nvm install && nvm use`.

```bash
npm install
cp .env.example .env.local
```

Nếu `.env.local` đã được thiết lập thì giữ nguyên file đó. Đặt `MANAGE_PIN=4321`, tạo `SESSION_SECRET` bằng lệnh sau và điền kết quả vào `.env.local`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```bash
npm run dev
```

Mở http://localhost:9090/manage và nhập PIN. Các scripts tự dùng Node 22 ở `/opt/homebrew/bin/node` nếu shell macOS đang dùng Node cũ; các máy khác cần Node 22 trong PATH.

| Đường dẫn | Chức năng |
| --- | --- |
| `/manage` | PIN, danh sách TV, thư viện ảnh, chỉnh sửa |
| `/manage/tvs/1/preview` | Preview riêng, xem hướng treo hoặc đầu ra browser |
| `/XLC/1` | Player TV số 1, public chỉ đọc |
| `/XLC/2` | Player TV số 2 sau khi tạo |

TV cùng Wi-Fi mở `http://<IP-máy-chạy-app>:9090/XLC/1`. `localhost` trên TV là chính TV, không phải máy chạy server. Khi mở/reload trang hoặc tải nội dung mới, máy chạy app phải bật và firewall phải cho phép cổng 9090.

## Quy trình vận hành

1. Vào `/manage`, nhập PIN **4321**.
2. Chọn **Chỉnh sửa** TV hoặc **Thêm màn hình**.
3. Upload ảnh JPG/PNG, hoặc chọn ảnh đã có trong thư viện. Tối đa 25 MiB/ảnh, 16 MP, 20 ảnh/TV.
4. Chọn hướng treo, góc xoay, hiện trọn ảnh/lấp đầy. Playlist hỗ trợ đổi thứ tự và 5–300 giây/ảnh.
5. **Lưu cấu hình**, sau đó **reload browser trên TV**. Một ảnh giữ nguyên; nhiều ảnh tự chuyển cục bộ.

Trang TV nhận toàn bộ cấu hình ngay trong HTML khi mở/reload. Player chạy độc lập, không tải React/Next client hoặc kết nối HMR; trang quản trị và preview vẫn dùng React/Next.js. Không polling, không tự refetch khi focus hoặc reconnect. Trang tổng quan thể hiện nội dung đã lưu, không đo tình trạng online của thiết bị. Ngừng sử dụng TV cũng chỉ có hiệu lực trên player khi mở/reload.

### Tắt server sau khi TV đã tải nội dung

Player tải toàn bộ ảnh trong playlist, kiểm tra giải mã và giữ bản ảnh trong bộ nhớ của tab bằng Blob URL (tải tối đa hai ảnh đồng thời). Đợi thông báo **Đã tải đủ ảnh** rồi có thể tắt server: một ảnh giữ nguyên, nhiều ảnh tiếp tục chuyển theo thời gian đã lưu. Nếu có ảnh lỗi, player giữ ảnh hiển thị thành công gần nhất và bỏ qua ảnh lỗi. Không gọi lại cấu hình khi mất/kết nối lại mạng.

Giữ TV bật và tab đang mở. Bộ nhớ này không bảo đảm tồn tại khi reload, đóng tab, browser tự giải phóng tab, hoặc khởi động lại TV; những trường hợp đó cần server hoạt động để mở lại trang. Chế độ này dùng được qua HTTP trong mạng nội bộ, không cần service worker. Trang `/XLC/<số TV>` không có cơ chế tự reload khi mất server, cả với `npm run dev` lẫn bản production. Khi vận hành thực tế vẫn nên dùng `npm run build` rồi `npm start`.

Đổi tên không thay URL. Số TV không tái sử dụng. Form chưa lưu có cảnh báo rời trang. Hai cửa sổ cùng lưu một revision: thao tác sau nhận lỗi xung đột thay vì ghi đè.

TV treo dọc có browser ngang: thường cần xoay 90° hoặc 270°. Nếu hệ điều hành đã xoay browser đúng dọc, chọn 0°. Dùng **Đầu ra browser** trong preview để kiểm tra; cần thử hướng thực tế trên TV.

## Dữ liệu khi chạy local

`STORAGE_DRIVER=local` lưu cấu hình trong `.signage-data/settings.json`, ảnh ở `.signage-data/media/`. Chúng được bỏ qua bởi Git. Dữ liệu không nằm trong localStorage nên máy tính quản lý và TV khác thiết bị vẫn dùng chung nội dung.

Sao lưu toàn bộ `.signage-data` cùng nhau. Có thể đặt `SIGNAGE_DATA_DIR` tới ổ đĩa bền vững. Bản local chỉ chạy một server process trên một thư mục dữ liệu. Lưu cấu hình dùng hàng đợi trong process và atomic rename. Ảnh cũ được giữ để không làm hỏng TV đang mở snapshot cũ.

## Triển khai Vercel, không cần database

Ứng dụng đã có storage adapter cho Vercel Blob. Tạo hai store trong Vercel:

- **Private Blob**: cấu hình JSON XLC, thư viện metadata và bộ đếm đăng nhập.
- **Public Blob**: file menu/quảng cáo mà TV được phép xem.

Đặt các biến môi trường:

```dotenv
MANAGE_PIN=4321
SESSION_SECRET=<random-secret-at-least-32-characters>
STORAGE_DRIVER=blob
CONFIG_BLOB_READ_WRITE_TOKEN=<private-store-token>
MEDIA_BLOB_READ_WRITE_TOKEN=<public-store-token>
```

Chọn Node.js 22.x, import repository Next.js và deploy. Không commit `.env.local` hoặc token. Trên Vercel, app từ chối ghi nếu chưa cấu hình Blob; không giả vờ lưu vào filesystem tạm. Local và Blob là hai bộ dữ liệu độc lập; khi chuyển lần đầu cần upload/chọn lại ảnh hoặc viết migration dữ liệu.

Ảnh upload trực tiếp từ browser đến Blob bằng token giới hạn pathname, MIME, kích thước, thời gian và không được overwrite. Endpoint finalize có PIN session xác minh ảnh thật ở server, chỉ sau đó ảnh mới được dùng. Không cần webhook/tunnel cho local. Upload thành công nhưng không finalize có thể để lại file chưa dùng; dọn riêng sau khi đối chiếu metadata.

Cấu hình đọc từ private Blob bằng `useCache: false`, ghi bằng ETag/conditional writes để tránh mất cập nhật. Manifest luôn `no-store`; ảnh URL bất biến được cache. Chế độ Blob cần kiểm thử thực tế bằng credential của hai store trước khi giao bản online; test local không kiểm chứng dịch vụ cloud.

## PIN và phạm vi

PIN được kiểm tra ở server. Session ký bằng secret, cookie HttpOnly/SameSite, có Secure khi truy cập HTTPS, hết hạn sau 12 giờ. Mọi API ghi và đọc quản trị đều kiểm tra session; mutation kiểm tra Origin. 5 lần sai trong 15 phút bị giới hạn; bộ đếm được lưu bền vững. PIN chung 4 số phù hợp bản đơn giản hiện tại, không phải phân quyền theo từng người. Thay PIN hoặc secret làm session cũ mất hiệu lực.

Menu trên player là public. Không dùng để đưa tài liệu riêng tư lên public media store. Không có tài khoản, đăng ký, danh sách thành viên, telemetry TV, video, hoặc bảo đảm offline sau reload trong bản này.

## Cấu trúc và mở rộng

- `src/app/manage`: trang quản trị có PIN.
- `src/components`: dashboard, form TV, upload, preview và renderer.
- `src/app/[slug]/[number]/route.ts`: trả HTML player public và một snapshot, không dùng Next client/HMR.
- `src/lib/player-document.ts`, `src/lib/player-script.ts`: HTML và runtime TV độc lập; chỉ tải ảnh lần đầu, giữ bằng Blob URL rồi chuyển ảnh cục bộ.
- `src/app/api`: session, quản trị, TV, upload và public manifest.
- `src/lib/store.ts`: storage adapter local / Blob; thay lớp này khi thêm database.
- `src/lib/auth.ts`: PIN/session; thay bằng đăng nhập và membership khi thêm nhiều người dùng.
- `src/lib/model.ts`: schema và model với restaurant XLC; giữ số TV, asset IDs và hợp đồng manifest khi migration.

## Kiểm tra

```bash
npm run typecheck
npm run build
npm test
npm start
```

API tests chạy production build trên port tạm, dùng thư mục dữ liệu tạm rồi dọn. Kiểm tra PIN, CSRF, ảnh >4.5 MB, ảnh giả, publish, xung đột, số TV, archive và cache. Test đơn vị kiểm tra chữ ký session, hết hạn, validation ảnh và hình học xoay. Chạy `npm run build` trước `npm test`.

Cần nghiệm thu thêm trên TV thật: browser tương thích Next.js hiện hành, chữ menu, xoay 4 góc, playlist chạy dài, fullscreen/screensaver và mất mạng. Local QA không thay thế kiểm tra thiết bị thật.
