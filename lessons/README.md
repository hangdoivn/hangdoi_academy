# Hang Đôi Academy — Lessons

Thư mục lưu trữ giáo trình và tài nguyên giảng dạy của Hang Đôi Academy.

## Quy ước cấu trúc

```text
lessons/
├── README.md
└── <course-slug>/
    ├── README.md
    └── lesson-XX-<lesson-slug>/
        ├── index.html
        ├── README.md
        ├── references.md
        ├── assets/
        │   └── README.md
        └── worksheets/
            └── README.md
```

### Quy ước đặt tên
- Course: chữ thường, kebab-case.
- Buổi học: `lesson-XX-ten-bai-hoc`.
- File bài giảng chính: `index.html`.
- Ảnh/tài nguyên sở hữu nội bộ: lưu trong `assets/`.
- Bài tập, template, handout: lưu trong `worksheets/`.
- Nguồn tham khảo bên ngoài: ghi trong `references.md`.

## Khóa học hiện có
- [Nhiếp ảnh cơ bản](./photography-basic/)
