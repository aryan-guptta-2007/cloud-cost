# Insecure S3 Bucket (triggers AWS_S3_PUBLIC)
resource "aws_s3_bucket" "insecure_bucket" {
  bucket = "sentra-insecure-data-leak"
  acl    = "public-read"
}

# Open Security Group (triggers AWS_SG_OPEN)
resource "aws_security_group" "insecure_sg" {
  name        = "insecure-ssh"
  description = "Allows SSH access from anywhere"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Wildcard IAM Policy (triggers AWS_IAM_WILDCARD)
resource "aws_iam_policy" "insecure_policy" {
  name        = "admin-policy"
  description = "Excessive wildcard permissions policy"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    }
  ]
}
EOF
}

# Unencrypted DB Instance (triggers AWS_DB_UNENCRYPTED)
resource "aws_db_instance" "insecure_db" {
  allocated_storage   = 20
  engine              = "postgres"
  engine_version      = "15.4"
  instance_class      = "db.t3.micro"
  db_name             = "insecuredb"
  username            = "postgres"
  password            = "SuperSecretPass123"
  storage_encrypted   = false
  skip_final_snapshot = true
}
