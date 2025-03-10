# Stay-Vista Backend

A robust backend application built with Node.js and Express.js, designed to handle essential backend operations such as API management, user authentication, payment integration, and database connectivity.

---

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Setup and Installation](#setup-and-installation)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Clone the Repository](#2-clone-the-repository)
  - [3. Install Dependencies](#3-install-dependencies)
  - [4. Configure Environment Variables](#4-configure-environment-variables)
  - [5. Start the Application](#5-start-the-application)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **User Authentication**: Secure JWT-based authentication.
- **Database Integration**: MongoDB for data storage and management.
- **Payment Gateway**: Seamless integration with Stripe for handling payments.
- **Email Notifications**: Send emails using Nodemailer.
- **CORS Handling**: Secure cross-origin resource sharing.
- **Environment Configurations**: Centralized configuration using `dotenv`.

---

## Technologies Used

- **Node.js**: Backend runtime environment.
- **Express.js**: Web application framework for creating APIs.
- **MongoDB**: NoSQL database for data storage.
- **JSON Web Token (JWT)**: Secure token-based authentication.
- **Nodemailer**: Email sending library.
- **Stripe**: Payment processing platform.
- **dotenv**: Environment variable management.

---

## Setup and Installation

Follow these steps to set up and run the project locally:

### 1. Prerequisites

Ensure the following are installed on your system:

- [Node.js (v16 or higher)](https://nodejs.org/)
- [npm (Node Package Manager)](https://www.npmjs.com/)
- [MongoDB](https://www.mongodb.com/try/download/community) (Local or cloud-based MongoDB instance)
- [Git](https://git-scm.com/)
- A Stripe account for payment integration ([Stripe Signup](https://stripe.com))

---

### 2. Clone the Repository

1. Open your terminal or command prompt.
2. Clone the repository by running:
   ```bash
   git clone https://github.com/Asad9340/Stay-Vista-Server.git
