# V-Rush

[![DOI](https://zenodo.org/badge/1211194989.svg)](https://doi.org/10.5281/zenodo.23137374)

**V-Rush** is an interactive computer-vision workbench for building, inspecting, and
sharing image-processing pipelines without writing glue code first. It brings
classical OpenCV operations, neural inference, local-feature matching, image
statistics, and executable code export into one browser-based studio.

V-Rush is maintained by **Mohamed ElBassat**, **Rokayya Aly**, and
**Seifeldin Elkerdany**.

**Research profile:** [ORCID: 0009-0006-3917-1319](https://orcid.org/0009-0006-3917-1319) ·
[Google Scholar](https://scholar.google.com/citations?user=cHdwvRsAAAAJ&hl=en)

> **Project status:** V-Rush is an active research/prototyping project. Interfaces,
> supported operations, and deployment details may change between releases.

## Why V-Rush?

Computer-vision experiments often require the same repetitive work: decoding images,
trying a preprocessing operation, comparing output pixels, tuning parameters, and
recreating the successful experiment in code. V-Rush makes that loop visual and
reproducible:

1. Upload an image and assemble an ordered pipeline.
2. Run the pipeline and compare before/after output.
3. Inspect histograms, image statistics, warnings, and model results.
4. Export the pipeline as Python or save its JSON recipe.

## Capabilities

- **Classical computer vision:** intensity and color transforms, denoising, linear
  filters, edges, morphology, geometric transforms, Fourier analysis, Gabor filters,
  texture features, and segmentation.
- **Detection and segmentation:** YOLO26 inference through ONNX Runtime, MobileSAM
  prompt-based masks, K-Means, Watershed, GrabCut, and connected components.
- **Image matching:** SIFT, ORB, AKAZE, and BRISK descriptors; BF or FLANN matching;
  Lowe's ratio test; and RANSAC homography filtering.
- **Visual diagnostics:** before/after previews, grayscale and RGB histograms, mean,
  standard deviation, extrema, output dimensions, and pipeline warnings.
- **Reproducible exports:** generated Python using OpenCV, NumPy, and ONNX Runtime,
  plus shareable pipeline JSON.
- **Optional application services:** Supabase authentication and Postgres usage
  logging, Kaggle dataset integration, and a FastAPI API.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`frontend/`](frontend/) | React, TypeScript, and Vite web application |
| [`backend/`](backend/) | FastAPI service and computer-vision operations |
| [`backend/tests/`](backend/tests/) | Backend test suite |
| [`supabase/`](supabase/) | Database migrations |
| [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md) | Deployment checklist |
| [`CITATION.cff`](CITATION.cff) | Machine-readable citation metadata |
| [`LICENSE`](LICENSE) | MIT license for the V-Rush source code |

## Run locally

### Requirements

- Python 3.11 or newer
- Node.js 20 or newer
- npm

Install dependencies from the repository root:

```bash
make install
```

Start the API in one terminal:

```bash
make run
```

Start the frontend in a second terminal:

```bash
make run-frontend
```

Open <http://localhost:5173>. For a quick local demo without Supabase, leave the
frontend Supabase variables unset and run the API with `KERNELLAB_AUTH_DISABLED=1`.
That mode is intended for local or private demos because it disables API
authentication.

Backend tests and linting:

```bash
make test
make lint
```

For authentication, database setup, environment variables, and production deployment,
see [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md).

## Models and optional weights

The repository includes `backend/yolo26n.onnx` for the YOLO26 operation. MobileSAM
encoder and decoder files are optional because of their size; export them locally
before enabling MobileSAM in a deployment. See the deployment checklist and
[`backend/scripts/export_mobile_sam.py`](backend/scripts/export_mobile_sam.py) for
the supported export workflow.

The included model files and third-party model code may have licenses separate from
this repository. Review the upstream licenses before redistribution or commercial
use. V-Rush does not claim ownership of third-party model weights.

## Citation and Google Scholar

### Cite the software

For a normal software citation, use the citation shown in [`CITATION.cff`](CITATION.cff).
GitHub can render that file and provide a **“Cite this repository”** button. After
creating a release, archive the release with Zenodo to obtain a DOI, then update the
version and DOI in the citation record.

Example BibTeX for the archived software release:

```bibtex
@software{elbassat2026vrush,
  author  = {ElBassat, Mohamed and Aly, Rokayya and Elkerdany, Seifeldin},
  title   = {V-Rush: An Interactive Computer-Vision Workbench},
  year    = {2026},
  version = {0.2.0},
  url     = {https://github.com/BASSAT-BASSAT/V_Rush},
  doi     = {10.5281/zenodo.23137374}
}
```

### Make it discoverable in Google Scholar

Google Scholar generally does **not** treat a GitHub README as a scholarly
publication. The reliable route is:

1. Create a **public, versioned GitHub release** with a meaningful version and release
   notes.
2. Connect the repository to **Zenodo** (enable the GitHub integration), then create a
   Zenodo release from the GitHub release. Zenodo mints a DOI and exposes structured
   metadata.
3. Add the DOI and the archived release URL to [`CITATION.cff`](CITATION.cff), the
   README, and any paper or technical report describing V-Rush.
4. Publish a short software paper, technical report, or dataset/methods paper in a
   scholarly venue that provides a stable public landing page and full bibliographic
   metadata. Put the DOI and repository URL in that publication.
5. Add the publication (not only the GitHub URL) to your Google Scholar profile. If
   Google Scholar has not found it after indexing, use **“Add article manually”** and
   enter the title, authors, venue, year, DOI, and public URL exactly as they appear
   in the publication.

Do not create a fake DOI or claim that Google Scholar indexes the repository
automatically. The DOI identifies the archived software; the scholarly paper is what
usually makes the work visible and citable in Scholar. Google Scholar controls its
own indexing schedule, so inclusion cannot be guaranteed.

## Contributing

Issues and pull requests are welcome. Please include reproducible steps, sample
inputs where redistribution is permitted, and the expected behavior. Do not commit
credentials, `.env` files, private datasets, or proprietary model weights.

## License

The V-Rush source code is released under the [MIT License](LICENSE). This license
applies to the project code and documentation unless a file or dependency states
otherwise. Third-party libraries, model weights, datasets, and generated assets may
have separate licenses; review their terms before redistribution.
