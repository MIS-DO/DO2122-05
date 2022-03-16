terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.0"
    }
  }

  backend "remote" {
    # The name of your Terraform Cloud organization.
    organization = "DO2122-05"

    # The name of the Terraform Cloud workspace to store Terraform state files in.
    workspaces {
      name = "DOS"
    }
  }
}

provider "aws" {
  region     = "eu-west-3"
  access_key = var.access_key
  secret_key = var.secret_key
}

resource "aws_instance" "machine01" {
  ami                         = "ami-08cfb7b19d5cd546d"
  instance_type               = "t2.micro"
  associate_public_ip_address = true
  key_name                    = var.key_name
  vpc_security_group_ids      = [aws_security_group.dos_sg.id]

  root_block_device {
    volume_size = 8 #GiB
  }

  connection {
    type        = "ssh"
    host        = self.public_ip
    user        = "ec2-user"
    private_key = file(var.key_path)
  }

  provisioner "remote-exec" {
    inline = [
      "sudo yum update -y",
      "sudo yum install -y docker",
      "sudo usermod -a -G docker ec2-user",
      "sudo curl -L https://github.com/docker/compose/releases/download/1.21.0/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose",
      "sudo chmod +x /usr/local/bin/docker-compose",
      "sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose",
      "sudo chkconfig docker on",
      "sudo service docker start",
      "sudo yum install -y git",
      "git clone https://github.com/MIS-DO/DO2122-05",
      "chmod u+x ./DO2122-05/start.sh"
    ]
  }

  provisioner "remote-exec" {
    inline = [
      "cd ./DO2122-05",
      "./start.sh"
    ]
  }
}

resource "aws_security_group" "dos_sg" {
  name = "dos_sg"

  lifecycle {
    create_before_destroy = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "todo el trafico"
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "ssh 22 / admin machines"
  }

  ingress {
    from_port   = 8008
    to_port     = 8008
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "expose 8008 to outside"
  }

  ingress {
    from_port   = 8001
    to_port     = 8001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "expose 8001 to outside"
  }
}

variable "access_key" {
  type = string
}

variable "secret_key" {
  type = string
}

variable "key_path" {
  type = string
}

variable "key_name" {
  type = string
}

