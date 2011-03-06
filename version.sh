#!/bin/bash
echo `date +%Y-%m-%d`.`git log --format='%ai' | awk '{print $1}' | sort | uniq | wc -l|sed 's/\s//g'`.`git log --format='%ai' | grep $(date +%Y-%m-%d) | wc -l|sed 's/\s//g'`
