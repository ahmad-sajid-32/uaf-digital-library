# UAF Digital Library

This is the repository for the UAF Digital Library project. It is a monorepo containing the backend API, a web application (in development), and database migrations.

## Project Structure

-   `apps/api`: The backend API built with Python and FastAPI.
-   `apps/web`: The frontend web application (currently a placeholder).
-   `supabase`: Database migrations and configuration for Supabase.

## Getting Started

### Prerequisites

-   Python 3.8+
-   Node.js (for the web app)
-   Supabase account

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    ```
2.  **Backend (API):**
    -   Navigate to the `apps/api` directory.
    -   Create a virtual environment: `python -m venv venv`
    -   Activate the virtual environment: `source venv/bin/activate` (on Linux/Mac) or `.\venv\Scripts\activate` (on Windows)
    -   Install the dependencies: `pip install -r requirements.txt`
3.  **Frontend (Web):**
    -   (Instructions to be added once the web app is developed)

### Running the application

1.  **Backend (API):**
    -   Navigate to the `apps/api` directory.
    -   Run the application: `uvicorn main:app --reload`
2.  **Frontend (Web):**
    -   (Instructions to be added once the web app is developed)

## Contributing

(Contributions are welcome. Please create an issue or a pull request.)

## License

(License to be determined.)
