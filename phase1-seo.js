(() => {
  const main = document.querySelector('main') || document.body;
  if (main && !main.id) main.id = 'main-content';
  if (!document.querySelector('.skip-link')) document.body.insertAdjacentHTML('afterbegin','<a class="skip-link" href="#main-content">Bỏ qua đến nội dung chính</a>');

  const heroTitle = document.querySelector('.hero h1');
  if (heroTitle) heroTitle.innerHTML = 'Học nhiếp ảnh tại Đà Nẵng để <em>làm được nghề thật.</em>';
  const heroDesc = document.querySelector('.hero-desc');
  if (heroDesc) heroDesc.textContent = 'Lộ trình thực hành từ kỹ thuật máy ảnh, ánh sáng và hậu kỳ đến portfolio. Học tại studio của Hang Đôi Academy, với nội dung được điều chỉnh theo mục tiêu và năng lực đầu vào.';

  const courseSection = document.querySelector('#khoa-hoc');
  if (courseSection && !document.querySelector('#gioi-thieu-hang-doi-academy')) {
    courseSection.insertAdjacentHTML('beforebegin', `
<section class="section seo-intro" id="gioi-thieu-hang-doi-academy">
  <div class="container seo-grid">
    <article class="seo-card">
      <span class="eyebrow">Học nhiếp ảnh tại Đà Nẵng</span>
      <h2>Hang Đôi Academy là môi trường đào tạo nhiếp ảnh thực hành gắn với production house.</h2>
      <p>Chương trình dành cho người mới bắt đầu, người muốn đi sâu một kỹ năng và người cần xây portfolio để phát triển nghề nghiệp. Học viên được thực hành tại studio, tiếp cận thiết bị và nhận feedback trực tiếp trên từng bài tập.</p>
      <div class="fact-list">
        <div class="fact-row"><strong>Địa điểm</strong><span>98 Điện Biên Phủ, Đà Nẵng</span></div>
        <div class="fact-row"><strong>Hình thức</strong><span>Học trực tiếp, lộ trình cá nhân hóa và thực hành tại studio</span></div>
        <div class="fact-row"><strong>Nhóm kỹ năng</strong><span>Kỹ thuật nhiếp ảnh, ánh sáng, chỉnh sửa hình ảnh và portfolio</span></div>
      </div>
    </article>
    <article class="seo-card highlight">
      <span class="eyebrow">Điểm khác biệt</span>
      <h3>Không chỉ học thao tác. Học cách hoàn thành một sản phẩm hình ảnh.</h3>
      <p>Mỗi lộ trình kết nối kiến thức với bài tập, feedback và đầu ra cụ thể. Người học hiểu vì sao chọn góc máy, nguồn sáng, màu sắc và cách xử lý hậu kỳ phù hợp với mục tiêu hình ảnh.</p>
      <div class="fact-list">
        <div class="fact-row"><strong>01</strong><span>Đánh giá xuất phát điểm trước khi chốt lộ trình</span></div>
        <div class="fact-row"><strong>02</strong><span>Thực hành trong studio và bối cảnh thực tế</span></div>
        <div class="fact-row"><strong>03</strong><span>Hoàn thiện sản phẩm và portfolio theo hướng cá nhân</span></div>
      </div>
    </article>
  </div>
</section>`);
  }

  document.querySelectorAll('.work-card').forEach(card => {
    if (card.querySelector('.case-insight')) return;
    const label = card.querySelector('.work-copy strong')?.textContent || 'Dự án thương mại';
    const type = card.querySelector('.work-type')?.textContent || 'PROJECT';
    card.insertAdjacentHTML('beforeend', `<div class="case-insight" aria-label="Thông tin dự án ${label}"><div><b>Bối cảnh</b><span>${type} thương mại</span></div><div><b>Trọng tâm</b><span>Ánh sáng, bố cục và tính nhất quán</span></div><div><b>Giá trị học tập</b><span>Quan sát quy trình tạo hình ảnh thực tế</span></div></div>`);
  });

  const faqTarget = document.querySelector('#faq');
  if (faqTarget && !document.querySelector('#cau-hoi-hoc-nhiep-anh')) {
    faqTarget.insertAdjacentHTML('beforebegin', `
<section class="section geo-faq" id="cau-hoi-hoc-nhiep-anh">
  <div class="container">
    <div class="section-head"><div><span class="eyebrow">Câu trả lời nhanh</span><h2>Thông tin cần biết khi học nhiếp ảnh tại Đà Nẵng.</h2></div><p>Câu trả lời ngắn, trực tiếp và có thể kiểm chứng về lộ trình học tại Hang Đôi Academy.</p></div>
    <div class="geo-faq-list">
      <details><summary>Người chưa biết sử dụng máy ảnh có học được không?</summary><p>Có. Khóa Nhiếp ảnh cơ bản bắt đầu từ thông số phơi sáng, lấy nét, tiêu cự, cân bằng trắng và cách vận hành máy trong từng bối cảnh.</p></details>
      <details><summary>Có cần mua máy ảnh trước khi đăng ký không?</summary><p>Không bắt buộc phải sở hữu đầy đủ thiết bị ngay từ đầu. Academy có môi trường studio và thiết bị phục vụ thực hành; nhu cầu thiết bị cá nhân sẽ được tư vấn theo mục tiêu học.</p></details>
      <details><summary>Khóa học nhiếp ảnh cơ bản kéo dài bao lâu?</summary><p>Lộ trình cơ bản hiện gồm 12 buổi. Nội dung tập trung vào làm chủ máy ảnh, tư duy hình ảnh, thực hành và hoàn thiện bộ ảnh đầu tiên.</p></details>
      <details><summary>Khóa kỹ năng chuyên sâu gồm những lựa chọn nào?</summary><p>Người học có thể chọn Kỹ thuật nhiếp ảnh, Kỹ thuật ánh sáng hoặc Chỉnh sửa hình ảnh. Học phí hiện tại là 18.680.000đ cho mỗi kỹ năng.</p></details>
      <details><summary>Khóa Nhiếp ảnh toàn tập phù hợp với ai?</summary><p>Lộ trình này phù hợp với người muốn phát triển toàn diện từ kỹ thuật, ánh sáng, hậu kỳ đến portfolio và định hướng bắt đầu làm nghề.</p></details>
      <details><summary>Học viên có được thực hành tại studio không?</summary><p>Có. Thực hành tại studio và xử lý bối cảnh thật là một phần cốt lõi của chương trình, không chỉ là buổi minh họa lý thuyết.</p></details>
      <details><summary>Academy có hỗ trợ xây portfolio không?</summary><p>Có. Với các lộ trình phù hợp, học viên được định hướng concept, chụp, chọn ảnh, hậu kỳ và hoàn thiện sản phẩm đủ rõ để giới thiệu năng lực.</p></details>
      <details><summary>Địa chỉ Hang Đôi Academy ở đâu?</summary><p>Hang Đôi Academy hoạt động tại 98 Điện Biên Phủ, Đà Nẵng. Người học nên liên hệ trước để được tư vấn lịch và lộ trình phù hợp.</p></details>
    </div>
  </div>
</section>`);
  }

  document.querySelectorAll('img').forEach((img, i) => {
    if (!img.alt || img.alt.trim().length < 8) img.alt = `Hình ảnh lớp học và dự án nhiếp ảnh tại Hang Đôi Academy Đà Nẵng ${i + 1}`;
    if (i > 0 && !img.loading) img.loading = 'lazy';
    img.decoding = 'async';
  });

  document.querySelectorAll('button').forEach(button => {
    if (!button.type) button.type = 'button';
  });
})();
