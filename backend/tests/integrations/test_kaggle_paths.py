import pytest

from app.integrations.kaggle_paths import KagglePathError, validate_dataset_file_path


def test_accepts_normal_dataset_paths() -> None:
    assert validate_dataset_file_path("train/cat.0.jpg") == "train/cat.0.jpg"
    assert validate_dataset_file_path("image.png") == "image.png"


@pytest.mark.parametrize(
    "path",
    [
        "",
        "../etc/passwd",
        "http://example.com/",
        "http://169.254.169.254/latest/meta-data/",
        "/absolute.jpg",
        "foo\\bar.jpg",
        "a@b.jpg",
        "train%2fsecret.jpg",
    ],
)
def test_rejects_dangerous_paths(path: str) -> None:
    with pytest.raises(KagglePathError):
        validate_dataset_file_path(path)
