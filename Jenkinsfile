pipeline {
    agent any

    environment {
        NODE_ENV = 'development'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'develop', url: 'https://github.com/SalvationIbeh/Live-Translation-Extension', credentialsId: 'Personal Access Key for Translation Extension'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Run Unit Tests') {
            steps {
                sh 'npm test'
            }
        }

        stage('Push to Integration') {
            when {
                branch 'develop'
            }
            steps {
                script {
                    sh """
                    git config user.name "UnitTestPipeline-jenkins"
                    git config user.email "salvationibeh@gmail"
                    git checkout -b integration
                    git merge develop
                    git push origin integration
                    """
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }

        success {
            echo 'Build and tests passed successfully!'
        }

        failure {
            echo 'Build or tests failed!'
        }
    }
}
